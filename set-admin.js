require("dotenv").config();
const pg = require("pg");
const bcrypt = require("bcrypt");

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Railway braucht SSL
});

async function setAdmin() {
    const name = process.env.ADMIN_NAME || "admin";
    const password = process.env.ADMIN_PASSWORD;
    const role = "admin";

    if (!password) {
        throw new Error("❌ ADMIN_PASSWORD ist nicht gesetzt");
    }

    const hash = await bcrypt.hash(password, 12);

    await pool.query(
        `
        INSERT INTO users (name, password, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (name)
        DO UPDATE SET
            password = EXCLUDED.password,
            role = EXCLUDED.role
        `,
        [name, hash, role]
    );

    console.log("✅ Admin auf Railway gesetzt / aktualisiert");
    process.exit(0);
}

setAdmin().catch(err => {
    console.error("❌ Fehler:", err.message);
    process.exit(1);
});
