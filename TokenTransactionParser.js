require('dotenv').config();
const WebSocket = require("ws");
const csv = require("csv-parse");
const { Decimal } = require("decimal.js");
const fs = require("fs");

class TokenTransactionParser {
    constructor(logger, mysqlDB) {
        this.WSOLMINT = "So11111111111111111111111111111111111111112";
        this.ws = null;
        this.logger = logger
        this.mysqlDB = mysqlDB
    }

    startPing() {
        setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
                this.logger.info("Ping sent");
            }
        }, 30000); // Ping every 30 seconds
    }

    async getTokenInfo(accountInfo, quantity) {
        const mint = accountInfo.mint;
        const decimals = accountInfo.decimals;
        const amount = new Decimal(quantity).dividedBy(new Decimal(10).pow(decimals));
        return { id: mint, amount, decimals : decimals };
    }

    sendRequest(walletList) {
        const request = {
            jsonrpc: "2.0",
            id: 420,
            method: "transactionSubscribe",
            params: [
                {
                    accountInclude: walletList,
                },
                {
                    commitment: "confirmed",
                    encoding: "jsonParsed",
                    transactionDetails: "full",
                    showRewards: true,
                    maxSupportedTransactionVersion: 0,
                },
            ],
        };
        this.ws.send(JSON.stringify(request));
    }

    async parseTransaction(tx) {
        const start_time = new Date();
        this.logger.info(`Parsing transaction ${tx.transaction.signatures[0]}`);

        const blockTime = new Date(start_time.getTime() - 3000);

        var swapEvents = [];
        var cnt = 0;

        var accountIndex2info = new Map();
        for (let j = 0; j < tx.meta.postTokenBalances.length; ++j) {
            const account = tx.meta.postTokenBalances[j];
            accountIndex2info.set(account.accountIndex, account);
        }
        var account2info = new Map();
        for (let idx = 0; idx < tx.transaction.message.accountKeys.length; ++idx) {
            const account = tx.transaction.message.accountKeys[idx];
            const info = accountIndex2info.get(idx);
            if (info == null) continue;
            account2info.set(account.pubkey.toString(), {
                mint: info.mint,
                decimals: info.uiTokenAmount.decimals,
            });
        }

        var tokens = []
        var decimals = {}
        for (let j = 0; j < tx.meta.innerInstructions.length; ++j) {
            const innerInstruction = tx.meta.innerInstructions[j];
            const swapInstructions = innerInstruction.instructions;
            var left = null;
            for (let i = 0; i < swapInstructions.length; i += 1) {
                if (swapInstructions[i].accounts) {
                    left = null;
                    continue;
                }
                if (
                    swapInstructions[i].parsed.type != "transfer" &&
                    swapInstructions[i].parsed.type != "transferChecked"
                )
                    continue;
                if (swapInstructions[i].parsed.info.authority == undefined) continue;
                if (left == null) {
                    left = swapInstructions[i];
                    continue;
                }

                var info = account2info.get(left.parsed.info.source);
                if (info == null) {
                    info = account2info.get(left.parsed.info.destination);
                }
                var sellToken = await this.getTokenInfo(
                    info,
                    left.parsed.info.amount
                        ? left.parsed.info.amount
                        : left.parsed.info.tokenAmount.amount
                );
                info = account2info.get(swapInstructions[i].parsed.info.source);
                if (info == null) {
                    info = account2info.get(swapInstructions[i].parsed.info.destination);
                }
                var buyToken = await this.getTokenInfo(
                    info,
                    swapInstructions[i].parsed.info.amount
                        ? swapInstructions[i].parsed.info.amount
                        : swapInstructions[i].parsed.info.tokenAmount.amount
                );
                cnt += 2;
                swapEvents.push({
                    token1: buyToken,
                    token0: sellToken,
                    slot: tx.slot,
                    signature: tx.transaction.signatures[0],
                    wallet: tx.transaction.message.accountKeys[0].pubkey.toString(),
                    created_at: blockTime,
                });
                if (!tokens.includes(sellToken.id)) {
                    tokens.push(sellToken.id);
                    decimals[sellToken.id] = sellToken.decimals
                }
                if (!tokens.includes(buyToken.id)) {
                    tokens.push(buyToken.id);
                    decimals[buyToken.id] = buyToken.decimals
                }
                left = null;
            }
        }

        tokens = tokens.filter(token => token !== this.WSOLMINT);
        tokens.forEach(token => {
            this.mysqlDB.createToken(token, decimals[token])
        });
        console.log(tokens)
        this.logger.info(`Finished in ${(new Date().getTime() - start_time.getTime()) / 1000} seconds`);
    }

    initializeWebSocket() {
        this.ws = new WebSocket(process.env.RPC_SOCKET);

        this.ws.on("open", async () => {
            this.logger.info(`WebSocket is open with ${process.env.RPC_SOCKET}`);
            const filePath = "sol_wallets.csv";

            const dataList = [];
            const readStream = fs.createReadStream(filePath);
            const parser = csv.parse({ delimiter: ",", from_line: 2 });

            parser.on("readable", () => {
                let record;
                while ((record = parser.read()) !== null) {
                    dataList.push(record[0]);
                }
            });

            parser.on("end", () => {
                this.sendRequest(dataList);
                this.startPing();
            });

            parser.on("error", (err) => {
                this.logger.error(err.message);
            });

            readStream.pipe(parser);
        });

        this.ws.on("message", (data) => {
            const messageStr = data.toString("utf8");
            try {
                const messageObj = JSON.parse(messageStr);
                if (!messageObj.params) return;
                const tx = messageObj.params.result.transaction;
                this.parseTransaction(tx);
            } catch (e) {
                this.logger.error("Failed to parse JSON:", e);
            }
        });

        this.ws.on("error", (err) => {
            this.logger.error("WebSocket error:", err);
        });

        this.ws.on("close", () => {
            this.logger.info("WebSocket is unexpectedly closed");
            this.logger.info("WebSocket is restarting in 5 seconds...");
            setTimeout(() => this.initializeWebSocket(), 5000);
        });
    }

    getPoolInfo(tokens) {
        // Implement your getPoolInfo function here
    }
}

module.exports = {
    TokenTransactionParser
}