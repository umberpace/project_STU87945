// The code below will be deployed as backend for the project 
// on Live canister ID ngccl-viaaa-aaaao-qeuwa-cai
// While the frontend will be access 
// on Live canister ID 7atcy-eiaaa-aaaak-qlphq-cai
// through Live ICP url https://7atcy-eiaaa-aaaak-qlphq-cai.icp0.io/ 


// Import necessary modules
import Map "mo:base/HashMap";  // HashMap to store barcode entries
import Text "mo:base/Text";    // Text manipulation and comparison utilities
import Int "mo:base/Int";      // Integer handling
import Lib "mo:ed25519";       // ED25519 library for signing and verifying
import Prim "mo:prim";         // Basic Motoko primitives (for encoding/decoding)
import Blob "mo:base/Blob";    // Blob utilities for base64 decoding
import Bool "mo:base/Bool";    // Boolean utilities
import Result "mo:base/Result";
import Error "mo:base/Error";


actor {
  // Define types for the actor
  
  // Barcode type representing a product's unique identifier
  type Barcode = Text;

  // Colour variant with predefined color options
  type Colour = {
    #Red;
    #Green;
    #Blue;
    #Yellow;
    #Black;
    #White;
  };

  // Entry type representing a luxury item in the store
  type Entry = {
    Name: Text;          // Name of the item
    WeightMil: Int;      // Weight of the item in milligrams
    Colour: Colour;      // Colour of the item, chosen from the Colour variant
    Year: Int;           // Year of manufacture or entry
  };

  // In-memory database using HashMap, storing items identified by their barcodes
  let itemsDB = Map.HashMap<Barcode, Entry>(0, Text.equal, Text.hash);

  // Public key used for verifying ED25519 signatures (hex-encoded)
  let publicKey : Text = "2EE078C9A47A4AF69B289ACACE7254580FBE3984786ADE435879589125049BF1";

  /**
   * Converts a given text to an array of Nat8 (bytes).
   * 
   * @param text - The input text to be converted to Nat8 array
   * @return Nat8 array representation of the text
   */
  func textToNat8(text: Text): [Nat8] {
    let blob: Blob = Prim.encodeUtf8(text);    // Encode text into UTF-8 Blob
    let nat8Array: [Nat8] = Prim.blobToArray(blob);  // Convert Blob to a Nat8 array
    return nat8Array;
  };

  /**
   * Authenticates a user by verifying the provided ED25519 signature.
   * The signature is expected to be in hex format.
   *
   * @param signature - The ED25519 signature provided by the user in hex format
   * @return - None. The function asserts if authentication fails.
   */
  public func auth(signature: Text): async () {
    let isValid = Lib.ED25519.verify(
      Lib.Utils.hexToBytes(signature),          // Convert the signature from hex to bytes
      textToNat8("login"),                      // Convert the "login" text to a Nat8 array
      Lib.Utils.hexToBytes(publicKey)           // Convert the public key from hex to bytes
    );
    assert(isValid == true);                    // Ensure the signature is valid
  };

  /**
   * Inserts a new item into the database, but only after verifying the provided signature.
   *
   * @param id - Barcode of the item to be inserted
   * @param entry - The Entry object containing item details (Name, WeightMil, Colour, Year)
   * @param signature - ED25519 signature in hex format that verifies the entry
   * @return - None. The function asserts if the signature is invalid.
   */
  public type Result<T, E> = {
    #ok: T;
    #err: E;
  };

  public func insert(id: Barcode, entry: Entry, signature: Text): async Result<Text, Text> {
      // Check if the barcode already exists in the itemsDB
      let existingEntry = itemsDB.get(id);
      
      if (existingEntry != null) {
        // If the entry exists, return an error result
        return #err("Item with this barcode already exists!");
      };

      // Verify the provided signature using ED25519
      let isValid = Lib.ED25519.verify(
        Lib.Utils.hexToBytes(signature),         // Convert signature from hex to bytes
        textToNat8(id),                          // Convert the barcode (id) to a Nat8 array
        Lib.Utils.hexToBytes(publicKey)         // Convert the public key from hex to bytes
      );

      assert(isValid == true);  

      // Insert the entry into the items database if the barcode is not present
      itemsDB.put(id, entry);
      
      return #ok("Item successfully inserted.");
  };

  /**
   * Retrieves the item entry associated with a given barcode.
   *
   * @param id - Barcode of the item to look up
   * @return - Optional Entry (None if the item doesn't exist, Some(Entry) if it does)
   */
  public query func lookup(id: Barcode): async ?Entry {
    return itemsDB.get(id);                    // Fetch the item from the database, if it exists
  };
};