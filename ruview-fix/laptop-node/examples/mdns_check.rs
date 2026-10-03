//! Registers the node's mDNS service and browses for it the way RuView
//! Desktop does (`mdns-sd`, `_ruview._udp.local.`), printing what it resolves.
use std::time::{Duration, Instant};
fn main() {
    let _d = ruview_laptop_node::register_mdns("testhost", "02:11:22:33:44:55", 1, 5005)
        .expect("register");
    let browser = mdns_sd::ServiceDaemon::new().unwrap();
    let rx = browser
        .browse(ruview_laptop_node::MDNS_SERVICE_TYPE)
        .unwrap();
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(8) {
        if let Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) =
            rx.recv_timeout(Duration::from_millis(200))
        {
            let p = info.get_properties();
            println!(
                "resolved {} addrs={:?} mac={:?} node_id={:?} version={:?} name={:?}",
                info.get_fullname(),
                info.get_addresses(),
                p.get("mac").map(|v| v.val_str()),
                p.get("node_id").map(|v| v.val_str()),
                p.get("version").map(|v| v.val_str()),
                p.get("name").map(|v| v.val_str())
            );
            return;
        }
    }
    println!("not resolved within 8 s");
    std::process::exit(1);
}
