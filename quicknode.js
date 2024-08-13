const web3 = require("@solana/web3.js");
(async () => {
    const publicKey = new web3.PublicKey(
        "55NQkFDwwW8noThkL9Rd5ngbgUU36fYZeos1k5ZwjGdn"
    );
    const solanaConnection = new web3.Connection("https://docs-demo.solana-mainnet.quiknode.pro/", {
        wsEndpoint: "wss://docs-demo.solana-mainnet.quiknode.pro/",
    });
    solanaConnection.blcok(
        publicKey,
        (updatedAccountInfo, context) =>
            console.log("Updated account info: ", updatedAccountInfo),
        {
            commitment : "confirmed",
            encoding : "jsonParsed"
        }
    );
})();
