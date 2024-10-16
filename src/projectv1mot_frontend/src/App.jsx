import { useState, useEffect } from 'react';
import { projectv1mot_backend } from '../../declarations/projectv1mot_backend';

import nacl from "../../../node_modules/tweetnacl";
import { decodeBase64, decodeUTF8 } from "../../../node_modules/tweetnacl-util";

function App() {
  const [lookedItem, setLookedItem] = useState([]);  // Stores the lookup result
  const [isAdmin, setIsAdmin] = useState(false);     // Tracks admin status
  const [isScreen, setIsScreen] = useState("home");     // Tracks admin status
  // setIsScreen('void'); VOID will be a global screen name reserved to disappear any active page content

  // useEffect hook to check for the secret key in the cookie when the component mounts
  useEffect(() => {
    const secretKey = getCookie('secretKey');
    if (secretKey) {
      handleAuth(secretKey);  // Attempt to authenticate if a key is found in cookies
    }
  }, []);  // Empty dependency array ensures this runs only once on mount

  // Helper function to convert a hex string to Uint8Array
  function hexToUint8Array(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return new Uint8Array(bytes);
  }

  // Helper function to convert Uint8Array to Hex string
  function toHex(byteArray) {
    return Array.from(byteArray, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Function to sign a message using a 32-byte private key and return the signature in hex format
  async function signMessage(message, hexPrivateKey) {
    try {
      const secretKey = hexToUint8Array(hexPrivateKey);  // Decode the private key from hex

      if (secretKey.length !== 32) {
        throw new Error("Private key must be 32 bytes long.");
      }

      const keyPair = nacl.sign.keyPair.fromSeed(secretKey);  // Generate the keypair from the private key
      const messageUint8 = decodeUTF8(message);               // Convert message to Uint8Array
      const signature = nacl.sign.detached(messageUint8, keyPair.secretKey);  // Sign the message
      return toHex(signature);  // Return the signature as a hex string
    } catch (error) {
      console.error("Error signing message:", error);
      throw error;
    }
  }

  // Parse object values recursively to handle BigInt types
  function parseBigIntValues(obj) {
    if (typeof obj === 'bigint') {
      return obj.toString();  // Convert BigInt to string
    } else if (Array.isArray(obj)) {
      return obj.map(parseBigIntValues);  // Recursively handle arrays
    } else if (typeof obj === 'object' && obj !== null) {
      const parsedObj = {};
      for (const key in obj) {
        parsedObj[key] = parseBigIntValues(obj[key]);  // Recursively handle objects
      }
      return parsedObj;
    }
    return obj;  // Return other types as is
  }

  // Handles the lookup form submission
  function handleLookup(event) {
    event.preventDefault();
    const barcode = event.target.elements.barcode.value;
    
    showLoader();

    try {
    projectv1mot_backend.lookup(barcode).then((item) => {
      hideLoader();  // Always hide the loader after processing

      if (item.length>0){
        // Extract and map the Colour field
        item[0].Colour = Object.keys(item[0].Colour)[0];
        setLookedItem(parseBigIntValues(item[0]));  // Update the state with the parsed item

        // Display the lookup result
        document.getElementById("item").style.display = 'block';

        setIsScreen('lookup')
        handleSuccess('The Barcode is Valid. Details about the item follow.')
      } else {
        handleError("This lookup returned an error. This barcode did not produce results.", false);
        setIsScreen('void');
      }

    });

    } catch (error) {
      hideLoader();  // Always hide the loader after processing
      handleError("This lookup returned an error. This barcode did not produce results.", false);
      setIsScreen('void');
    }
    
    return false;
  }

  // Toggle class for admin/logout, and delete secretKey cookie on logout
  const toggleClass = () => {
    if (isAdmin) {
      deleteCookie('secretKey');  // Delete the secret key on logout
      setIsScreen("home")
    }
    setIsAdmin(!isAdmin);
  };

  // Show the loader animation
  function showLoader() {
    document.getElementById('loader').style.display = 'flex';
  }

  // Hide the loader animation
  function hideLoader() {
    document.getElementById('loader').style.display = 'none';
  }

  // Authenticate the user with the provided key (or prompt for one)
  async function handleAuth(providedKey = null) {
    let sk = (typeof providedKey === "string" && providedKey.trim() !== "") ? providedKey : prompt("Insert your secret key");

    if (!sk) {
      alert("Secret key is required!");
      return false;
    }
  
    try {
      const signedMessage = await signMessage("login", sk);  // Sign the login message
      showLoader();

      // Call the backend to authenticate
      projectv1mot_backend.auth(signedMessage).then((result) => {
        setIsScreen('add-item')
        document.cookie = `secretKey=${sk}; path=/; secure; samesite=strict;`;  // Save the key in cookies
        toggleClass();  // Toggle admin status
        hideLoader();  // Always hide the loader after processing
      });
    } catch (error) {
      hideLoader();  // Always hide the loader after processing
      console.error("Authentication failed:", error);
      alert("Authentication failed. Please check your secret key.");
    } 
  
    return false;
  }

  // Get a cookie value by name
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Delete a specific cookie by name
  function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  // Form state variables
  const [itemBarcode, setItemBarcode] = useState('');  // State for barcode input
  const [itemName, setItemName] = useState('');        // State for name input
  const [itemWeight, setItemWeight] = useState('');    // State for weight input
  const [itemColour, setItemColour] = useState('');    // State for colour selection
  const [itemYear, setItemYear] = useState('');        // State for year input

  // Handle form submission for adding a new item
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    
    const privateKey = getCookie('secretKey');  // Retrieve the secret key from cookies
    if (!privateKey) {
      alert("Private key not found. Please authenticate first.");
      return;
    }
  
    const colourMap = {  // Map the selected color to the Motoko variant format
      "#Red": { Red: null },
      "#Green": { Green: null },
      "#Blue": { Blue: null },
      "#Yellow": { Yellow: null },
      "#Black": { Black: null },
      "#White": { White: null }
    };
  
    const selectedColour = colourMap[itemColour];
    if (!selectedColour) {
      alert("Invalid colour selected.");
      return;
    }
  
    const entry = {  // Create the Entry object as per the Motoko backend structure
      Name: itemName,
      WeightMil: parseInt(itemWeight),
      Colour: selectedColour,
      Year: parseInt(itemYear)
    };

    showLoader();
    try {
      const signature = await signMessage(itemBarcode, privateKey);  // Sign the barcode with the private key
      let result = await projectv1mot_backend.insert(itemBarcode, entry, signature);  // Call the backend to insert the item

      // Check if the result is #ok or #err
      if ('ok' in result) {
        // If it's #ok, log or display the success message
        console.log(result);
        handleSuccess("The item was created successfuly.", false);
        setIsScreen('void');
      } else if ('err' in result) {
        // If it's #err, log or display the error message
        console.error("Error:", result.err);
        handleError("Item with this barcode exists already.");
      }
      hideLoader();  // Always hide the loader after processing
      
    } catch (error) {
      hideLoader();  // Always hide the loader after processing
      handleError("An unexpected error happened.");
    }
  
    // Reset form fields
    setItemBarcode('');
    setItemName('');
    setItemWeight('');
    setItemColour('');
    setItemYear('');
  };


  const [message, setMessage] = useState({ type: '', text: '' });

  // Function to handle showing the success message
  const handleSuccess = (message, timer=true) => {
    setMessage({ type: 'success', text: message });
    // Timer will make disappear the message, but on void pages where only an error is displayed we don't want it to disappear automatically so in those cases we set timer=false calling the method
    if (timer){
      startTimer();
    }
  };

  // Function to handle showing the error message
  const handleError = (message, timer=true) => {
    setMessage({ type: 'error', text: message });
    // Timer will make disappear the message, but on void pages where only an error is displayed we don't want it to disappear automatically so in those cases we set timer=false calling the method
    if (timer){
      startTimer();
    }
  };

  // Start a 5-second timer to hide the message
  const startTimer = () => {
    setTimeout(() => {
      setMessage({ type: '', text: '' }); // Clear the message after 5 seconds
    }, 15000);
  };

  // Function to manually close the message container when "X" is clicked
  const closeMessage = () => {
    setMessage({ type: '', text: '' });
  };

  return (
    <body>
      <header>
        <div class="top-bar">
          <form class="lookup-form" action="#" onSubmit={handleLookup}>
            <div class="input-container">
              <input type="text" id="barcode" alt="Barcode" placeholder="Scan or Enter QR Code" />
              <button type="submit" id="lookupButton" class="lookup-btn">Lookup</button>
            </div>
          </form>
        </div>
      </header>
   
      <main>


      <div>
        {/* Success and Error Message Containers */}
        <div className={`message-container ${message.type === 'success' ? 'success' : ''}`}>
          {message.type === 'success' && (
            <p>
              {message.text}
              <span className="close-btn" onClick={closeMessage}>×</span>
            </p>
          )}
        </div>

        <div className={`message-container ${message.type === 'error' ? 'error' : ''}`}>
          {message.type === 'error' && (
            <p>
              {message.text}
              <span className="close-btn" onClick={closeMessage}>×</span>
            </p>
          )}
        </div>
      </div>

        {/* Add Item Form */}
        <section className={'add-item-form ' + (isAdmin ? 'isAdmin' : 'isNotAdmin')}  style={{ display: isScreen === "add-item" ? "block" : "none" }}>
          <h2>Please add a new Item</h2>
          <form id="addItemForm" onSubmit={handleFormSubmit}>
            {/* Form fields */}
            {/* Form fields */}
            <input
              type="text"
              id="itemBarcode"
              placeholder="Barcode"
              value={itemBarcode}
              onChange={(e) => setItemBarcode(e.target.value)}
              required
            />

            <input
              type="text"
              id="itemName"
              placeholder="Item Name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />

            <input
              type="number"
              id="itemWeight"
              placeholder="Weight (in grams)"
              value={itemWeight}
              onChange={(e) => setItemWeight(e.target.value)}
              required
            />

            <input
              type="number"
              id="itemYear"
              placeholder="Year"
              value={itemYear}
              onChange={(e) => setItemYear(e.target.value)}
              required
            />

            <br></br>
            <select
              id="itemColor"
              value={itemColour}
              onChange={(e) => setItemColour(e.target.value)}
              required
            >
              <option value="">Choose colour</option>
              <option value="#Red">Red</option>
              <option value="#Green">Green</option>
              <option value="#Blue">Blue</option>
              <option value="#Yellow">Yellow</option>
              <option value="#Black">Black</option>
              <option value="#White">White</option>
            </select>

            <br></br>

            <button type="submit" id="addItemButton">Add Item</button>
          </form>
        </section>

        {/* Lookup Results Section */}
        <section class="results-section" id="item" style={{ display: isScreen === "lookup" ? "block" : "none" }}>
          <div class="card-content white-text">
            <span class="card-title">Item Details</span>
            <p>Name: {lookedItem.Name}</p>
            <p>Year: {lookedItem.Year}</p>
            <p>Weight: {lookedItem.WeightMil} mg</p>
            <p>Colour: {lookedItem.Colour}</p>
          </div>
        </section>



        {/* Introductory Home Section */}
        <div class="board" style={{ display: isScreen === "home" ? "block" : "none" }}>
          <div class="top_box">
            <p class="intro-message">
              Welcome to Luxury Watches dApp! Our dApp is built on ICP using Motoko and the data is immutable once written to the blockchain. This makes it extremely secure from tampering by hackers or bad actors. Blockchain technology enables a decentralized, secure, and user-controlled digital ecosystem.
            </p>
          </div>
          <div class="left-right-container">
            <div class="left_box">
              <p>
                <b>Administrator?</b><br /> You can add new luxury watches to the system once you're logged in.
              </p>
            </div>
            <div class="right_box">
              <p>
                <b>Buyer?</b><br /> You can quickly look up details for any item by scanning its QR code or entering its barcode.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer section with Admin/Logout buttons */}
      <footer>
        <div class="buttons-container">
          <button onClick={handleAuth} id="adminButton" className={'auth-btn ' + (isAdmin ? 'isNotAdmin' : 'isAdmin')}>Admin</button>
          <button onClick={() => setIsScreen("home")} id="logoutButton" className={'auth-btn ' + (isAdmin ? 'isAdmin' : 'isNotAdmin')}>Home</button>
          <button onClick={() => setIsScreen("add-item")} id="logoutButton" className={'auth-btn ' + (isAdmin ? 'isAdmin' : 'isNotAdmin')}>Add Item</button>
          <button onClick={toggleClass} id="logoutButton" className={'auth-btn ' + (isAdmin ? 'isAdmin' : 'isNotAdmin')}>Logout</button>
        </div>
        <p>&copy; 2024 Luxury Goods Verification. All rights reserved.</p>
      </footer>

      {/* Loader Element */}
      <div id="loader" class="loader-container">
        <div class="loader"></div>
      </div>
    </body>
  );
}

export default App;