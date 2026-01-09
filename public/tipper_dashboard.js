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
        //await ladeSpiele();
        await name_ermitteln();
        await ladeGeplanteSpiele();
        $("tippenBtn").addEventListener("click", tippen);  
        $("logoutBtn")?.addEventListener("click", logout);     

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

// Logout
// ===============================
async function logout() {
    await api("/api/logout", { method: "POST" });
    location.href = "/";
}


// ===============================
// Spiele
// ===============================
/*
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






        const tbody = document.getElementById("SpieleTabelle");
        tbody.innerHTML = "";

        spiele.forEach(s => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${s.heimverein}</td>
                <td>${s.gastverein}</td>
                <td>${new Date(s.anstoss).toLocaleString("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short"  
                })}</td>
                <td>${s.heimtore} : ${s.gasttore}</td>
                <td>${s.statuswort}</td>
                            `;
        });
       
}
*/
// ===============================
// Geplante Spiele laden
// ===============================
async function ladeGeplanteSpiele() {
    try {
        const spiele = await api("/api/spiele");
        const tbody = $("spieleBody");
        tbody.innerHTML = "";

        // nur geplante Spiele
        const geplant = spiele.filter(s => s.statuswort === "geplant");

        if (geplant.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="4">Keine geplanten Spiele</td>`;
            tbody.appendChild(tr);
            return;
        }

        geplant.forEach(s => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${new Date(s.anstoss).toLocaleString("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short"
                })}</td>
                <td>${s.heimverein}</td>
                <td>${s.gastverein}</td>
                <td>${s.statuswort}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("❌ Spiele laden fehlgeschlagen:", err);
    }
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




