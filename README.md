Overview

This project demonstrates a set of features and functionalities I have implemented, including frontend UI enhancements, backend API development, MetaMask integration, and a Solidity smart contract.

The main tasks completed are:

1. Scroll-Up Button

Added a scroll-up button on the landing page.

Behavior:

Visible only when the user scrolls down more than 100px.

Fixed position at a corner of the viewport.

Smoothly scrolls the page back to the top when clicked.

Fully responsive and works across different devices and screen sizes.

2. Notes CRUD API

Implemented a basic CRUD API for a "Notes" application.

Endpoints:

POST /notes — create a new note.

GET /notes — retrieve all notes.

GET /notes/:id — retrieve a note by ID.

PUT /notes/:id — update a note.

DELETE /notes/:id — delete a note.

Notes are stored in an in-memory data structure (no database required).

Results are displayed either on the console or on a simple frontend page.

3. MetaMask Wallet Integration

Integrated MetaMask wallet into the application.

Features:

Connect to MetaMask wallet.

Prompt user to install MetaMask if not detected.

Display connected wallet address in the UI.

Handle account changes (switching accounts in MetaMask).

Handle network changes (switching Ethereum networks in MetaMask).

4. Investment Smart Contract

Developed a secure and efficient investment smart contract in Solidity.

Features:

Users can invest ETH.

Records investor information.

Tracks total investments.

Simulates distribution of returns.

Contract code is located in the smart-contract directory.

Getting Started
Prerequisites

Node.js and npm installed

MetaMask (for wallet integration)

Ethereum test network (e.g., Rinkeby or Ropsten) for smart contract testing

Installation

Clone the project:

git clone <project-repo-link>
cd <project-folder>


Install dependencies:

npm install


If using legacy peer dependencies:

npm install --legacy-peer-deps

Running the Project
npm start


This will start the frontend application.

The Notes API and scroll-up button features will be accessible in the browser.

MetaMask wallet integration will be available for Ethereum interactions.


Loom video link: <insert-link-here>

Project Structure
project-root/
│
├─ smart-contract/      # Solidity investment smart contract
├─ src/                 # Frontend React application
├─ backend/             # Notes API
├─ package.json
└─ README.md
