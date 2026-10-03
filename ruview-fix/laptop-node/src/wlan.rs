//! Windows Native WiFi (`wlanapi.dll`) access: connected-link RSSI, WiFi
//! scans and the cached BSS list. Other platforms get a stub that reports
//! the platform as unsupported instead of inventing readings.

use ruview_laptop_node::ApReading;

/// The WiFi link this laptop is currently associated with.
#[derive(Debug, Clone)]
pub struct Link {
    pub ssid: String,
    pub bssid: [u8; 6],
    pub rssi_dbm: f64,
    /// Windows' 0-100 signal quality for the link.
    pub quality_pct: u32,
}

/// Win32 error code carried by a failed WLAN API call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WlanError(pub u32);

impl WlanError {
    /// `ERROR_ACCESS_DENIED`: on Windows 11 24H2+ WiFi details require
    /// "Location services" and "Let desktop apps access your location".
    pub fn is_access_denied(self) -> bool {
        self.0 == 5
    }
}

impl std::fmt::Display for WlanError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.0 {
            5 => write!(f, "access denied (Win32 error 5) - turn on Windows Location services for desktop apps"),
            1062 => write!(f, "the WLAN AutoConfig service is not running (Win32 error 1062)"),
            2 => write!(f, "no WiFi adapter found (Win32 error 2)"),
            0x8034_2002 => write!(f, "the WiFi adapter is not connected (0x80342002)"),
            code => write!(f, "Win32 error {code}"),
        }
    }
}

#[cfg(windows)]
pub use imp::Wlan;

#[cfg(windows)]
#[allow(unsafe_code)]
mod imp {
    use super::{Link, WlanError};
    use ruview_laptop_node::ApReading;
    use std::ffi::c_void;
    use std::ptr;
    use windows_sys::core::GUID;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::NetworkManagement::WiFi::{
        dot11_BSS_type_any, wlan_interface_state_connected, wlan_intf_opcode_current_connection,
        wlan_intf_opcode_rssi, WlanCloseHandle, WlanEnumInterfaces, WlanFreeMemory,
        WlanGetNetworkBssList, WlanOpenHandle, WlanQueryInterface, WlanScan, DOT11_SSID,
        WLAN_BSS_ENTRY, WLAN_BSS_LIST, WLAN_CONNECTION_ATTRIBUTES, WLAN_INTERFACE_INFO,
        WLAN_INTERFACE_INFO_LIST,
    };

    const WLAN_CLIENT_VERSION_2: u32 = 2;

    fn check(rc: u32) -> Result<(), WlanError> {
        if rc == 0 {
            Ok(())
        } else {
            Err(WlanError(rc))
        }
    }

    fn ssid_string(s: &DOT11_SSID) -> String {
        let n = (s.uSSIDLength as usize).min(32);
        String::from_utf8_lossy(&s.ucSSID[..n])
            .trim_end_matches('\0')
            .to_string()
    }

    /// An open WLAN API session bound to one WiFi interface.
    pub struct Wlan {
        handle: HANDLE,
        guid: GUID,
        pub description: String,
    }

    // The WLAN client handle may be used from any thread.
    unsafe impl Send for Wlan {}

    impl Wlan {
        /// Open a session and pick the first connected WiFi interface (or the
        /// first interface when none is connected yet).
        pub fn open() -> Result<Self, WlanError> {
            let mut negotiated = 0u32;
            let mut handle: HANDLE = ptr::null_mut();
            // SAFETY: out-params point at locals; `preserved` must be null.
            check(unsafe {
                WlanOpenHandle(
                    WLAN_CLIENT_VERSION_2,
                    ptr::null(),
                    &mut negotiated,
                    &mut handle,
                )
            })?;

            let mut list: *mut WLAN_INTERFACE_INFO_LIST = ptr::null_mut();
            // SAFETY: `handle` is a live session; out-param is a local.
            let rc = unsafe { WlanEnumInterfaces(handle, ptr::null(), &mut list) };
            if rc != 0 || list.is_null() {
                // SAFETY: handle came from WlanOpenHandle and is not reused.
                unsafe { WlanCloseHandle(handle, ptr::null()) };
                return Err(WlanError(if rc != 0 { rc } else { 2 }));
            }
            // SAFETY: non-null API-allocated list; dwNumberOfItems bounds the
            // trailing InterfaceInfo array.
            let picked = unsafe {
                let n = (*list).dwNumberOfItems as usize;
                let base = ptr::addr_of!((*list).InterfaceInfo).cast::<WLAN_INTERFACE_INFO>();
                let ifaces: Vec<WLAN_INTERFACE_INFO> = (0..n).map(|i| *base.add(i)).collect();
                WlanFreeMemory(list.cast());
                ifaces
                    .iter()
                    .find(|i| i.isState == wlan_interface_state_connected)
                    .or_else(|| ifaces.first())
                    .copied()
            };
            let Some(iface) = picked else {
                // SAFETY: as above.
                unsafe { WlanCloseHandle(handle, ptr::null()) };
                return Err(WlanError(2));
            };
            let desc_len = iface
                .strInterfaceDescription
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(256);
            Ok(Self {
                handle,
                guid: iface.InterfaceGuid,
                description: String::from_utf16_lossy(&iface.strInterfaceDescription[..desc_len]),
            })
        }

        /// The interface GUID as 16 raw bytes (used to derive a stable node MAC).
        pub fn guid_bytes(&self) -> [u8; 16] {
            let g = &self.guid;
            let mut b = [0u8; 16];
            b[0..4].copy_from_slice(&g.data1.to_le_bytes());
            b[4..6].copy_from_slice(&g.data2.to_le_bytes());
            b[6..8].copy_from_slice(&g.data3.to_le_bytes());
            b[8..16].copy_from_slice(&g.data4);
            b
        }

        fn query<T: Copy>(&self, opcode: i32) -> Result<T, WlanError> {
            let mut size = 0u32;
            let mut data: *mut c_void = ptr::null_mut();
            // SAFETY: live handle and GUID; out-params are locals.
            check(unsafe {
                WlanQueryInterface(
                    self.handle,
                    &self.guid,
                    opcode,
                    ptr::null(),
                    &mut size,
                    &mut data,
                    ptr::null_mut(),
                )
            })?;
            if data.is_null() || (size as usize) < std::mem::size_of::<T>() {
                if !data.is_null() {
                    // SAFETY: API-allocated buffer, not used afterwards.
                    unsafe { WlanFreeMemory(data) };
                }
                return Err(WlanError(13)); // ERROR_INVALID_DATA
            }
            // SAFETY: the buffer holds at least size_of::<T>() bytes of T;
            // read_unaligned avoids any alignment assumption.
            let value = unsafe { ptr::read_unaligned(data.cast::<T>()) };
            // SAFETY: API-allocated buffer, not used afterwards.
            unsafe { WlanFreeMemory(data) };
            Ok(value)
        }

        /// RSSI of the current connection in dBm, straight from the driver.
        pub fn rssi(&self) -> Result<i32, WlanError> {
            self.query::<i32>(wlan_intf_opcode_rssi)
        }

        /// The current connection (SSID, BSSID, signal quality) plus a fresh RSSI.
        pub fn link(&self) -> Result<Link, WlanError> {
            let attrs: WLAN_CONNECTION_ATTRIBUTES =
                self.query(wlan_intf_opcode_current_connection)?;
            if attrs.isState != wlan_interface_state_connected {
                return Err(WlanError(0x8034_2002));
            }
            let assoc = attrs.wlanAssociationAttributes;
            let quality = assoc.wlanSignalQuality;
            let rssi = match self.rssi() {
                Ok(r) => f64::from(r),
                // Some drivers do not implement the RSSI opcode; Windows'
                // signal quality is linear in RSSI between -100 and -50 dBm.
                Err(_) => -100.0 + f64::from(quality) / 2.0,
            };
            Ok(Link {
                ssid: ssid_string(&assoc.dot11Ssid),
                bssid: assoc.dot11Bssid,
                rssi_dbm: rssi,
                quality_pct: quality,
            })
        }

        /// Ask the driver for a fresh scan. Results show up in
        /// [`Wlan::bss_list`] a few seconds later.
        pub fn request_scan(&self) -> Result<(), WlanError> {
            // SAFETY: live handle and GUID; optional params are null.
            check(unsafe {
                WlanScan(
                    self.handle,
                    &self.guid,
                    ptr::null(),
                    ptr::null(),
                    ptr::null(),
                )
            })
        }

        /// Access points from the driver's most recent scan.
        pub fn bss_list(&self) -> Result<Vec<ApReading>, WlanError> {
            let mut list: *mut WLAN_BSS_LIST = ptr::null_mut();
            // SAFETY: live handle and GUID; null SSID = all networks.
            check(unsafe {
                WlanGetNetworkBssList(
                    self.handle,
                    &self.guid,
                    ptr::null(),
                    dot11_BSS_type_any,
                    0,
                    ptr::null(),
                    &mut list,
                )
            })?;
            if list.is_null() {
                return Ok(Vec::new());
            }
            // SAFETY: non-null API-allocated list; dwNumberOfItems bounds the
            // trailing wlanBssEntries array.
            let out = unsafe {
                let n = (*list).dwNumberOfItems as usize;
                let base = ptr::addr_of!((*list).wlanBssEntries).cast::<WLAN_BSS_ENTRY>();
                let v = (0..n)
                    .map(|i| {
                        let e = &*base.add(i);
                        ApReading {
                            bssid: e.dot11Bssid,
                            ssid: ssid_string(&e.dot11Ssid),
                            rssi_dbm: f64::from(e.lRssi),
                            freq_mhz: e.ulChCenterFrequency / 1000,
                        }
                    })
                    .collect();
                WlanFreeMemory(list.cast());
                v
            };
            Ok(out)
        }
    }

    impl Drop for Wlan {
        fn drop(&mut self) {
            // SAFETY: handle came from WlanOpenHandle and is closed once.
            unsafe { WlanCloseHandle(self.handle, ptr::null()) };
        }
    }
}

#[cfg(not(windows))]
pub use stub::Wlan;

#[cfg(not(windows))]
mod stub {
    use super::{Link, WlanError};
    use ruview_laptop_node::ApReading;

    /// Non-Windows stub: the Native WiFi API only exists on Windows.
    pub struct Wlan {
        pub description: String,
    }

    impl Wlan {
        pub fn open() -> Result<Self, WlanError> {
            Err(WlanError(50)) // ERROR_NOT_SUPPORTED
        }
        pub fn guid_bytes(&self) -> [u8; 16] {
            [0; 16]
        }
        pub fn rssi(&self) -> Result<i32, WlanError> {
            Err(WlanError(50))
        }
        pub fn link(&self) -> Result<Link, WlanError> {
            Err(WlanError(50))
        }
        pub fn request_scan(&self) -> Result<(), WlanError> {
            Err(WlanError(50))
        }
        pub fn bss_list(&self) -> Result<Vec<ApReading>, WlanError> {
            Err(WlanError(50))
        }
    }
}

/// Frequency of the connected AP, looked up in a scan result.
pub fn freq_for(bssid: &[u8; 6], readings: &[ApReading]) -> Option<u32> {
    readings
        .iter()
        .find(|r| &r.bssid == bssid)
        .map(|r| r.freq_mhz)
}
