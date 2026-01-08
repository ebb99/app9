// ===============================
// ENV
// ===============================
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

console.log("ENV CHECK:", process.env.DATABASE_URL);

// ===============================
// Imports
// ===============================
const express = require("express");
const pg = require("pg");
const path = require("path");
const cron = require("node-cron");
const session = require("express-session");
const bcrypt = require("bcrypt");

// ===============================
// App
// ===============================
const app = express();
const PORT = process.env.PORT || 8080;

// ===============================
// Konstanten
// ===============================
const SPIELZEIT_MINUTEN = 3;
const NACHSPIELZEIT_MINUTEN = 2;

// ===============================
// Middleware
// ===============================
app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: process.env.SESSION_SECRET || "super-geheim",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// ===============================
// Auth Middleware (NUR API)
// ===============================
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Login erforderlich" });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.status(403).json({ error: "Nur Admin" });
    }
    next();
}

function requireTipper(req, res, next) {
    if (!req.session.user || req.session.user.role !== "tipper") {
        return res.status(403).json({ error: "Nur Tipper erlaubt" });
    }
    next();
}

// ===============================
// Datenbank
// ===============================
const isRailway =
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("localhost");

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isRailway ? { rejectUnauthorized: false } : false
});

pool.connect()
    .then(c => {
        c.release();
        console.log("PostgreSQL verbunden");
    })
    .catch(err => console.error("DB Fehler:", err));

// ===============================
// Cron Jobs
// ===============================
cron.schedule("* * * * *", async () => {
    try {
        await pool.query(`
            UPDATE spiele
            SET statuswort = 'live'
            WHERE statuswort = 'geplant'
              AND anstoss <= NOW()
        `);

        await pool.query(`
            UPDATE spiele
            SET statuswort = 'beendet'
            WHERE statuswort = 'live'
              AND anstoss
                + INTERVAL '${SPIELZEIT_MINUTEN} minutes'
                + INTERVAL '${NACHSPIELZEIT_MINUTEN} minutes'
                <= NOW()
        `);
    } catch (err) {
        console.error("Cron Fehler:", err);
    }
});




async function werteSpielAus(spielId) {
    const spielRes = await pool.query(
        "SELECT * FROM spiele WHERE id=$1",
        [spielId]
    );
    const spiel = spielRes.rows[0];

    const tipsRes = await pool.query(
        "SELECT * FROM tips WHERE spiel_id=$1",
        [spielId]
    );

    for (const tipp of tipsRes.rows) {
        const punkte = berechnePunkte(tipp, spiel);

        await pool.query(
            "UPDATE tips SET punkte=$1 WHERE id=$2",
            [punkte, tipp.id]
        );
    }

    await pool.query(
        "UPDATE spiele SET statuswort='ausgewertet' WHERE id=$1",
        [spielId]
    );
}
app.get("/api/rangliste", requireLogin, async (req, res) => {
    const result = await pool.query(`
    SELECT u.name, COALESCE(SUM(t.punkte),0) AS punkte
    FROM users u
    LEFT JOIN tips t ON u.id = t.user_id
    GROUP BY u.id
    ORDER BY punkte DESC
    `);
    res.json(result.rows);
});


// ===============================
// HTML Seiten (OHNE Auth)
// ===============================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin_dashboard.html"));
});

app.get("/tippen.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "tippen.html"));
});

// ===============================
// Session / Auth API
// ===============================
app.post("/api/login", async (req, res) => {
    const { name, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT id, name, role, password FROM users WHERE name = $1",
            [name]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Login fehlgeschlagen" });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
            return res.status(401).json({ error: "Login fehlgeschlagen" });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            role: user.role
        };

        res.json({ role: user.role });

    } catch (err) {
        res.status(500).json({ error: "Login-Fehler" });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ message: "Logout ok" }));
});

app.get("/api/session", (req, res) => {
    res.json({ user: req.session.user || null });
});


// ===============================
// Zeiten API
// ===============================
app.get("/api/zeiten", requireLogin, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, zeit FROM zeiten ORDER BY zeit"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Zeiten laden fehlgeschlagen" });
    }
});

app.post("/api/zeiten", requireAdmin, async (req, res) => {
    const { zeit } = req.body;

    try {
        const result = await pool.query(
            "INSERT INTO zeiten (zeit) VALUES ($1) RETURNING *",
            [zeit]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Zeit speichern fehlgeschlagen" });
    }
});

app.delete("/api/zeiten/:id", requireAdmin, async (req, res) => {
    try {
        await pool.query("DELETE FROM zeiten WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Zeit löschen fehlgeschlagen" });
    }
});

// ===============================
// Vereine API
// ===============================
app.get("/api/vereine", requireLogin, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, vereinsname FROM vereine ORDER BY vereinsname"
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Vereine laden fehlgeschlagen" });
    }
});

app.post("/api/vereine", requireAdmin, async (req, res) => {
    const { vereinsname } = req.body;

    try {
        const result = await pool.query(
            "INSERT INTO vereine (vereinsname) VALUES ($1) RETURNING *",
            [vereinsname]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Verein speichern fehlgeschlagen" });
    }
});

app.delete("/api/vereine/:id", requireAdmin, async (req, res) => {
    try {
        await pool.query("DELETE FROM vereine WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Verein löschen fehlgeschlagen" });
    }
});





// ===============================
// Spiele API
// ===============================
app.get("/api/spiele", requireLogin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, anstoss, heimverein, gastverein,
                    heimtore, gasttore, statuswort
             FROM spiele
             ORDER BY anstoss`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Laden der Spiele" });
    }
});


app.post("/api/spiele", requireAdmin, async (req, res) => {
    const { anstoss, heimverein, gastverein, heimtore, gasttore, statuswort } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO spiele
             (anstoss, heimverein, gastverein, heimtore, gasttore, statuswort)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [anstoss, heimverein, gastverein, heimtore, gasttore, statuswort]
        );
        res.json(result.rows[0]);
    } catch {
        res.status(500).json({ error: "Spiel anlegen fehlgeschlagen" });
    }
});

app.patch("/api/spiele/:id/auswerten", requireAdmin, async (req, res) => {
    const { heimtore, gasttore } = req.body;
    const spielId = req.params.id;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1️⃣ Spiel aktualisieren
        const spielRes = await client.query(`
            UPDATE spiele
            SET heimtore = $1,
                gasttore = $2,
                statuswort = 'ausgewertet'
            WHERE id = $3
            RETURNING *
        `, [heimtore, gasttore, spielId]);

        if (spielRes.rowCount === 0) {
            throw new Error("Spiel nicht gefunden");
        }

        // 2️⃣ Alte Punkte löschen (wichtig für Korrektur!)
        await client.query(`
            UPDATE tips
            SET punkte = 0
            WHERE spiel_id = $1
        `, [spielId]);

        // 3️⃣ Tipps laden
        const tipsRes = await client.query(`
            SELECT id, heimtipp, gasttipp
            FROM tips
            WHERE spiel_id = $1
        `, [spielId]);

        // 4️⃣ Punkte berechnen
        for (const t of tipsRes.rows) {
            let punkte = 0;

            const richtigesErgebnis =
                t.heimtipp === heimtore &&
                t.gasttipp === gasttore;

            const richtigeTendenz =
                Math.sign(t.heimtipp - t.gasttipp) ===
                Math.sign(heimtore - gasttore);

            if (richtigesErgebnis) punkte = 3;
            else if (richtigeTendenz) punkte = 1;

            await client.query(`
                UPDATE tips
                SET punkte = $1
                WHERE id = $2
            `, [punkte, t.id]);
        }

        await client.query("COMMIT");

        res.json({
            message: "Ergebnis gespeichert & Punkte neu berechnet",
            spiel: spielRes.rows[0]
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Auswertung Fehler:", err);
        res.status(500).json({ error: "Auswertung fehlgeschlagen" });
    } finally {
        client.release();
    }
});

// ===============================
// Spiel löschen (ADMIN)
// ===============================
app.delete("/api/spiele/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        // 1️⃣ Tipps zum Spiel löschen (wichtig wegen FK!)
        await pool.query(
            "DELETE FROM tips WHERE spiel_id = $1",
            [id]
        );

        // 2️⃣ Spiel löschen
        const result = await pool.query(
            "DELETE FROM spiele WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Spiel nicht gefunden" });
        }

        res.json({ ok: true, id });

    } catch (err) {
        console.error("Spiel löschen Fehler:", err);
        res.status(500).json({ error: "Spiel konnte nicht gelöscht werden" });
    }
});

app.post("/api/tips", requireLogin, requireTipper, async (req, res) => {
    const { spiel_id, heimtipp, gasttipp } = req.body;

    try {
        // Spiel laden
        const spielRes = await pool.query(
            "SELECT anstoss, statuswort FROM spiele WHERE id=$1",
            [spiel_id]
        );

        if (spielRes.rowCount === 0) {
            return res.status(404).json({ error: "Spiel nicht gefunden" });
        }

        const spiel = spielRes.rows[0];

        // Status prüfen
        if (spiel.statuswort !== "geplant") {
            return res.status(403).json({ error: "Spiel nicht mehr tippbar" });
        }

        // Zeitfenster prüfen
        if (new Date(spiel.anstoss) <= new Date()) {
            return res.status(403).json({ error: "Anstoßzeit überschritten" });
        }

        // Tipp speichern / überschreiben
        const result = await pool.query(`
            INSERT INTO tips (user_id, spiel_id, heimtipp, gasttipp)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (user_id, spiel_id)
            DO UPDATE SET
                heimtipp=$3,
                gasttipp=$4,
                updated_at=NOW()
            RETURNING *`,
            [req.session.user.id, spiel_id, heimtipp, gasttipp]
        );

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Tippen fehlgeschlagen" });
    }
});

// ===============================
// Tipps anzeigen (für Dashboard)
// ===============================
app.get("/api/tips", requireLogin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.id,
                t.spiel_id,
                t.heimtipp,
                t.gasttipp,
                u.name AS user_name,
                s.heimverein,
                s.gastverein,
                s.anstoss,
                s.statuswort
            FROM tips t
            JOIN users u ON u.id = t.user_id
            JOIN spiele s ON s.id = t.spiel_id
            ORDER BY s.anstoss, u.name
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("❌ GET /api/tips:", err);
        res.status(500).json({ error: "Tipps laden fehlgeschlagen" });
    }
});


app.get("/api/rangliste", requireLogin, async (req, res) => {
    const result = await pool.query(`
        SELECT u.name, COALESCE(SUM(t.punkte),0) AS punkte
        FROM users u
        LEFT JOIN tips t ON t.user_id = u.id
        WHERE u.role = 'tipper'
        GROUP BY u.id
        ORDER BY punkte DESC, u.name
    `);

    res.json(result.rows);
});


// ===============================
// User API (Admin)
// ===============================
app.get("/api/users", requireAdmin, async (req, res) => {
    const result = await pool.query(
        "SELECT id, name, role FROM users ORDER BY name"
    );
    res.json(result.rows);
});

app.post("/api/users", requireAdmin, async (req, res) => {
    const { name, password, role } = req.body;

    console.log("👤 NEW USER:", req.body); // ← WICHTIG

    if (!name || !password || !role) {
        return res.status(400).json({ error: "Daten fehlen" });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
        "INSERT INTO users (name, password, role) VALUES ($1,$2,$3) RETURNING id,name,role",
        [name, hash, role]
    );

    res.json(result.rows[0]);
});


app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
    res.json({ success: true });
});

// ===============================
// Ergebnis eintragen & auswerten
// ===============================
app.patch(
  "/api/spiele/:id/ergebnis",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    const spielId = req.params.id;
    const { heimtore, gasttore } = req.body;

    if (
      heimtore === undefined ||
      gasttore === undefined
    ) {
      return res.status(400).json({ error: "Ergebnis fehlt" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1️⃣ Spiel prüfen
      const spielRes = await client.query(
        "SELECT * FROM spiele WHERE id = $1",
        [spielId]
      );

      if (spielRes.rowCount === 0) {
        throw new Error("Spiel nicht gefunden");
      }

      const spiel = spielRes.rows[0];

      if (spiel.statuswort === "beendet") {
        throw new Error("Spiel bereits ausgewertet");
      }

      // 2️⃣ Spiel aktualisieren
      await client.query(
        `
        UPDATE spiele
        SET heimtore = $1,
            gasttore = $2,
            statuswort = 'beendet'
        WHERE id = $3
        `,
        [heimtore, gasttore, spielId]
      );

      // 3️⃣ Tipps laden
      const tipsRes = await client.query(
        "SELECT * FROM tips WHERE spiel_id = $1",
        [spielId]
      );

      // 4️⃣ Punkte berechnen
      for (const tipp of tipsRes.rows) {
        let punkte = 0;

        // exakt
        if (
          tipp.heimtipp === heimtore &&
          tipp.gasttipp === gasttore
        ) {
          punkte = 3;
        }
        // richtige Tendenz
        else if (
          (tipp.heimtipp - tipp.gasttipp) *
          (heimtore - gasttore) > 0
        ) {
          punkte = 1;
        }

        await client.query(
          "UPDATE tips SET punkte = $1 WHERE id = $2",
          [punkte, tipp.id]
        );
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Ergebnis gespeichert & Punkte berechnet",
        ausgewerteteTipps: tipsRes.rowCount
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Ergebnis-Auswertung:", err);
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  }
);




// ===============================
// Start
// ===============================
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
