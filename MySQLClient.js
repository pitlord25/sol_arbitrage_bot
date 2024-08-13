const mysql = require('mysql2');
const { RaydiumService } = require('./RaydiumService');
const { OrcaService } = require('./OrcaService');
const { WSOLMint } = require('@raydium-io/raydium-sdk-v2');
const { MeteoraService } = require('./MeteoraService');

class MySQLClient {
    constructor(config, logger) {
        this.connection = mysql.createConnection(config);
        this.logger = logger
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.connection.connect((err) => {
                if (err) {
                    console.log(err)
                    reject('Error connecting to the database:', err);
                } else {
                    resolve('Connected to the database.');
                }
            });
        });
    }

    async checkAndCreateTable() {
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tbl_target_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tokens VARCHAR(255) NOT NULL,
        raydiumAmm TEXT,
        raydiumCLMM TEXT,
        orcaWhirlpool TEXT,
        meteoraDLMM TEXT,
        decimals TEXT
      )
    `;
        return this.query(createTableQuery);
    }

    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, params, (err, results, fields) => {
                if (err) {
                    reject('Error executing query:', err);
                } else {
                    resolve({ results, fields });
                }
            });
        });
    }

    async createToken(token, decimals) {

        const promises = [
            RaydiumService.fetchRaydiumAmmPoolAddressByToken(token),
            RaydiumService.fetchRaydiumCpmmPoolAddressByToken(token),
            OrcaService.fetchOrcaPoolListByToken(WSOLMint.toBase58(), token),
            OrcaService.fetchOrcaPoolListByToken(token, WSOLMint.toBase58()),
            MeteoraService.fetchMeteoraDlmmPoolAddressByToken(token)
        ]
        Promise.all(promises)
            .then(async(result) => {

                // Fetch pool addresses 
                
                const raydiumAmmPools = RaydiumService.filterPool(result[0])
                const raydiumCpmmPools = RaydiumService.filterPool(result[1])
                const orcaWhirlpools = [...result[2], ...result[3]]
                const meteoraDlmmPools = MeteoraService.filterPool(result[4])
                let check = [raydiumAmmPools, raydiumCpmmPools, orcaWhirlpools, meteoraDlmmPools].filter(arr => arr.length === 0).length
                if (check == 3) 
                    return
                // this.logger.info(`Raydium Amm : ${JSON.stringify(raydiumAmmPools)}, Radyium Clmm : ${JSON.stringify(raydiumCpmmPools)}, Orca Whirl: ${JSON.stringify(orcaWhirlpools)}, Meteora Dlmm : ${JSON.stringify(meteoraDlmmPools)}`)

                // Check if the token already exists
                const checkQuery = 'SELECT id FROM tbl_target_tokens WHERE tokens = ?';
                const checkResult = await this.query(checkQuery, [token]);

                if (checkResult.results.length > 0) {
                    // Token already exists
                    // return { message: 'Token already exists.' };
                    const updateQuery = `
            UPDATE tbl_target_tokens
            SET raydiumAmm = ?, raydiumCLMM = ?, orcaWhirlpool = ?, meteoraDLMM = ?, decimals = ?
            WHERE id = ?`;
                    return this.query(updateQuery, [JSON.stringify(raydiumAmmPools), JSON.stringify(raydiumCpmmPools), JSON.stringify(orcaWhirlpools), JSON.stringify(meteoraDlmmPools), checkResult.results[0].id, decimals]);
                }

                // Insert the new token
                const insertQuery = 'INSERT INTO tbl_target_tokens (tokens, raydiumAmm, raydiumCLMM, orcaWhirlpool, meteoraDLMM, decimals) VALUES (?, ?, ?, ?, ?, ?)';
                return this.query(insertQuery, [token, JSON.stringify(raydiumAmmPools), JSON.stringify(raydiumCpmmPools), JSON.stringify(orcaWhirlpools), JSON.stringify(meteoraDlmmPools), decimals]);
            })
            .catch(err => {
                this.logger.error(err)
            })
    }

    async readTokens() {
        const selectQuery = 'SELECT * FROM tbl_target_tokens';
        return this.query(selectQuery);
    }

    async updateToken(id, newToken) {
        const updateQuery = 'UPDATE tbl_target_tokens SET tokens = ? WHERE id = ?';
        return this.query(updateQuery, [newToken, id]);
    }

    async deleteToken(id) {
        const deleteQuery = 'DELETE FROM tbl_target_tokens WHERE id = ?';
        return this.query(deleteQuery, [id]);
    }

    async end() {
        return new Promise((resolve, reject) => {
            this.connection.end((err) => {
                if (err) {
                    reject('Error closing the connection:', err);
                } else {
                    resolve('Connection closed.');
                }
            });
        });
    }
}

module.exports = {
    MySQLClient
}