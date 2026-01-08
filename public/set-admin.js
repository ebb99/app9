require("dotenv").config();
const pg = require("pg");
const bcrypt = require("bcrypt");

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false }
});

async function setAdmin() {
    const name = "admin";
    const password = "admin123";
    const role = "admin";

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
        `
        INSERT INTO users (name, password, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (name)
        DO UPDATE SET password = EXCLUDED.password,
                     role = EXCLUDED.role
        `,
        [name, hash, role]
    );

    console.log("✅ Admin-Passwort gesetzt / aktualisiert");
    process.exit();
}

setAdmin().catch(console.error);
