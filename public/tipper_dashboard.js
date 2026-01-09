console.log("✅ tipper_dashboard.js geladen");

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
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await checkSession("tipper");
        await ladeSpiele();
        await name_ermitteln();
        $("tippenBtn").addEventListener("click", tippen);       //$("btnTippen").addEventListener("click", tippen);

        console.log("✅ Tipper Dashboard bereit");
    } catch (err) {
        console.error(err);
        location.href = "/";
    }
});

tippen;
async function tippen() {
   alert("Hier geht's zum Tippen!");
}

/*
document.getElementById("tippenBtn").addEventListener("click", async (e) => {
    e.preventDefault();

    alert("Hier geht's zum Tippen!");
});

*/
// ===============================
// Spiele
// ===============================
async function ladeSpiele() {
    const spiele = await api("/api/spiele");
    $("spieleSelect").innerHTML = `<option value="">Bitte wählen …</option>`;

    spiele
        .filter(s => s.statuswort === "geplant")
        .forEach(s => {
        const text = `${new Date(s.anstoss).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
})}



${s.heimverein} – ${s.gastverein}`;
            $("spieleSelect").appendChild(new Option(text, s.id));
        });
}

async function name_ermitteln(requiredRole = null) {
    const res = await fetch("/api/session", {
        credentials: "include"
    });

    if (!res.ok) {
        throw new Error("Session-Fehler");
    }

    const data = await res.json();

    if (!data.user) {
        throw new Error("Nicht eingeloggt");
    }

    if (requiredRole && data.user.role !== requiredRole) {
        throw new Error("Keine Berechtigung");
    }
    //console.log("Eingeloggt als:", data.user);
    $("benutzername").innerHTML = data.user.name;
    return data.user;
}






