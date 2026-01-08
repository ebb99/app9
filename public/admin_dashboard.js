console.log("✅ admin_dashboard.js geladen");
// ===============================
// Helper
// ===============================
async function api(url, options = {}) {
    const res = await fetch(url, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...options
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.statusText);
    }

    return res.status === 204 ? null : res.json();
}

function $(id) {
    return document.getElementById(id);
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    ladeZeiten();
    ladeVereine();
    ladeSpiele();
    ladeUser();

    $("logoutBtn")?.addEventListener("click", logout);
    $("saveZeit")?.addEventListener("click", zeitSpeichern);
    $("deleteZeit")?.addEventListener("click", zeitLoeschen);

    $("saveVerein")?.addEventListener("click", vereinSpeichern);
    $("deleteVerein")?.addEventListener("click", vereinLoeschen);

    $("saveSpiel")?.addEventListener("click", spielSpeichern);
    $("deleteSpiel")?.addEventListener("click", spielLoeschen);
    $("saveErgebnis")?.addEventListener("click", ergebnisSpeichernUndAuswerten);
    
    $("userForm")?.addEventListener("submit", userAnlegen);
});

// ===============================
// Logout
// ===============================
async function logout() {
    await api("/api/logout", { method: "POST" });
    location.href = "/";
}

// ===============================
// Zeiten
// ===============================
function $(id) {
    return document.getElementById(id);
}

// ===============================
// Zeiten
// ===============================

async function ladeZeiten() {
    console.log("⏳ ladeZeiten()");

    try {
        const res = await fetch("/api/zeiten", {
            credentials: "include"
        });

        if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }

        const zeiten = await res.json();
        console.log("📦 Zeiten:", zeiten);

        const select1 = $("zeitenSelect");
        const select2 = $("AuswahlzeitSelect");

        if (!select1 || !select2) {
            console.error("❌ Zeiten-Select nicht gefunden", {
                zeitenSelect: !!select1,
                AuswahlzeitSelect: !!select2
            });
            return;
        }

        select1.innerHTML = "";
        select2.innerHTML = "";

        zeiten.forEach(z => {
            //const text = new Date(z.zeit).toLocaleString("de-DE");
           // const text = new Date(z.zeit);

const text = `${new Date(z.zeit).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
})}`;




            select1.appendChild(new Option(text, z.id));
            select2.appendChild(new Option(text, z.id));
        });

        console.log("✅ Zeiten angezeigt");

    } catch (err) {
        console.error("❌ ladeZeiten Fehler:", err);
    }
}


// ===============================
// Start
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    console.log("📄 DOM geladen");
    ladeZeiten();
});


async function zeitSpeichern() {
    const v = $("zeitInput").value;
    if (!v) return alert("Zeit fehlt");

    await api("/api/zeiten", {
        method: "POST",
        body: JSON.stringify({ zeit: v })
        
    });

    $("zeitInput").value = "";
    ladeZeiten();
}

async function zeitLoeschen() {
    const id = $("zeitenSelect").value;
    if (!id) return;

    await api(`/api/zeiten/${id}`, { method: "DELETE" });
    ladeZeiten();
}

// ===============================
// Vereine
// ===============================
async function ladeVereine() {
    const vereine = await api("/api/vereine");

    ["vereineSelect", "heimSelect", "gastSelect"].forEach(id => $(id).innerHTML = "");

    vereine.forEach(v => {
        ["vereineSelect", "heimSelect", "gastSelect"].forEach(id => {
            $(id).appendChild(new Option(v.vereinsname, v.id));
        });
    });
}

async function vereinSpeichern() {
    const name = $("vereinInput").value.trim();
    if (!name) return alert("Name fehlt");

    await api("/api/vereine", {
        method: "POST",
        body: JSON.stringify({ vereinsname: name })
    });

    $("vereinInput").value = "";
    ladeVereine();
}

async function vereinLoeschen() {
    const id = $("vereineSelect").value;
    if (!id) return;

    await api(`/api/vereine/${id}`, { method: "DELETE" });
    ladeVereine();
}

// ===============================
// Spiele
// ===============================
async function ladeSpiele() {
    const spiele = await api("/api/spiele");
    $("spieleSelect").innerHTML = "";

    spiele.forEach(s => {
        const text = `${new Date(s.anstoss).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
})}
        
        ${s.heimverein} : ${s.gastverein}
        ${s.heimtore}:${s.gasttore} (${s.statuswort})`;

        $("spieleSelect").appendChild(new Option(text, s.id));
    });
}

async function spielSpeichern() {
    const zeitId = $("AuswahlzeitSelect").value;
    const heimId = $("heimSelect").selectedOptions[0]?.text;
    const gastId = $("gastSelect").selectedOptions[0]?.text;
    console.log({ zeitId, heimId, gastId });
    if (!zeitId || !heimId || !gastId) {
        return alert("Bitte Zeit & Vereine wählen");
    }

    const zeiten = await api("/api/zeiten");
    const zeit = zeiten.find(z => z.id == zeitId);

    await api("/api/spiele", {
        method: "POST",
        body: JSON.stringify({
            anstoss: zeit.zeit,
            heimverein: heimId,
            gastverein: gastId,
            heimtore: 0,
            gasttore: 0,
            statuswort: "geplant"
        })
    });

    ladeSpiele();
}

async function spielLoeschen() {
    const id = $("spieleSelect").value;
    if (!id) return;
    console.log("Lösche Spiel mit ID:", id);
    await api(`/api/spiele/${id}`, { method: "DELETE" });
    ladeSpiele();
}

async function ergebnisSpeichernUndAuswerten() {
    const id = $("spieleSelect").value;
    if (!id) return alert("Spiel wählen");

    const heimtore = Number($("heimtoreInput").value);
    const gasttore = Number($("gasttoreInput").value);

    try {
        const res = await api(`/api/spiele/${id}/auswerten`, {
            method: "PATCH",
            body: JSON.stringify({ heimtore, gasttore })
        });

        alert("✅ Ergebnis gespeichert & Punkte berechnet");
        ladeSpiele();

    } catch (err) {
        alert("❌ Fehler bei der Auswertung");
        console.error(err);
    }
}



/// ===============================
// Benutzerverwaltung
// ===============================
async function ladeUser() {
    try {
        const res = await fetch("/api/users", {
            credentials: "include"
        });

        if (!res.ok) {
            throw new Error("User laden fehlgeschlagen");
        }

        const users = await res.json();
        console.log("👤 USERS:", users);

        const tbody = document.getElementById("userTable");
        tbody.innerHTML = "";

        users.forEach(u => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${u.name}</td>
                <td>${u.role}</td>
                <td>
                    <button data-id="${u.id}">Löschen</button>
                </td>
            `;

            tr.querySelector("button").addEventListener("click", async () => {
                if (!confirm(`User ${u.name} löschen?`)) return;

                await fetch(`/api/users/${u.id}`, {
                    method: "DELETE",
                    credentials: "include"
                });

                ladeUser();
            });

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("❌ ladeUser:", err);
        alert("Benutzer konnten nicht geladen werden");
    }
}

async function userAnlegen(e) {
    e.preventDefault();

    const name = $("userName").value.trim();
    const password = $("userPassword").value;
    const role = $("userRole").value;

    if (!name || !password) {
        return alert("Name und Passwort erforderlich");
    }

    const res = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password, role })
    });

    if (!res.ok) {
        const t = await res.text();
        alert("Fehler: " + t);
        return;
    }

    $("userForm").reset();
    ladeUser();
}
async function ladeRangliste() {
    const daten = await api("/api/rangliste");

    const tbody = $("ranglisteBody");
    tbody.innerHTML = "";

    daten.forEach((u, i) => {
        tbody.innerHTML += `
            <tr>
                <td>${i + 1}</td>
                <td>${u.name}</td>
                <td>${u.punkte}</td>
            </tr>
        `;
    });
}
