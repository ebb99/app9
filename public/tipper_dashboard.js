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
        await ladeTipps();
        await ladeRangliste();

        $("btnTippen").addEventListener("click", tippSpeichern);

        console.log("✅ Tipper Dashboard bereit");
    } catch (err) {
        console.error(err);
        location.href = "/";
    }
});

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

/*
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
*/








// ===============================
// Tipp speichern
// ===============================
async function tippSpeichern() {
    const spiel_id = $("spieleSelect").value;
    const heimtipp = $("heimtipp").value;
    const gasttipp = $("gasttipp").value;

    if (!spiel_id || heimtipp === "" || gasttipp === "") {
        return alert("Bitte Spiel und Tipp eingeben");
    }

    await api("/api/tips", {
        method: "POST",
        body: JSON.stringify({
            spiel_id,
            heimtipp: Number(heimtipp),
            gasttipp: Number(gasttipp)
        })
    });

    $("meldung").innerText = "✅ Tipp gespeichert";

    await ladeTipps();
    await ladeRangliste();
}

// ===============================
// Alle Tipps
// ===============================
async function ladeTipps() {
    const tips = await api("/api/tips");
    const container = $("tipListe");
    container.innerHTML = "";

    const spieleMap = {};

    tips.forEach(t => {
        if (!spieleMap[t.spiel_id]) {
            spieleMap[t.spiel_id] = {
                spiel: t,
                tips: []
            };
        }
        spieleMap[t.spiel_id].tips.push(t);
    });

    Object.values(spieleMap).forEach(gruppe => {
        const div = document.createElement("div");
        div.className = "spiel";

        div.innerHTML = `
            <h3>${gruppe.spiel.heimverein} – ${gruppe.spiel.gastverein}</h3>
            <div class="status">
                ${gruppe.spiel.statuswort} | ${new Date(gruppe.spiel.anstoss).toLocaleString()}
            </div>
        `;

        gruppe.tips.forEach(t => {
            const row = document.createElement("div");
            row.className = "tipp";
            row.innerHTML = `
                <span><b>${t.user_name}</b></span>
                <span>${t.heimtipp} : ${t.gasttipp}</span>
            `;
            div.appendChild(row);
        });

        container.appendChild(div);
    });
}

// ===============================
// Rangliste
// ===============================
async function ladeRangliste() {
    const daten = await api("/api/rangliste");
    $("ranglisteBody").innerHTML = "";

    daten.forEach((u, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${u.name}</td>
            <td>${u.punkte}</td>
        `;
        $("ranglisteBody").appendChild(tr);
    });
}
