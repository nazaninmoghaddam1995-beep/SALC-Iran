const CONTENT_BANK_URL = "../data/content-bank.json";

function escapeHTML(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Only allow http(s) and relative links
function safeUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url, window.location.href);
        return ["http:", "https:"].includes(parsed.protocol)
            ? escapeHTML(url)
            : null;
    } catch {
        return null;
    }
}

function renderActivity(activity) {
    const url = activity.status === "available" ? safeUrl(activity.url) : null;

    return `
        <article class="activity-item">
            <span class="content-skill">
                Step ${escapeHTML(activity.stage)} · ${escapeHTML(activity.skill)}
            </span>
            <h4>${escapeHTML(activity.title)}</h4>
            <p>${escapeHTML(activity.description)}</p>
            ${
                url
                    ? `<a class="check-button" href="${url}">Start Activity →</a>`
                    : `<span class="content-coming-soon">Coming soon</span>`
            }
        </article>
    `;
}

function renderTopic(topic, index, containerId) {
    const panelId = `${containerId}-topic-${index}`;
    const activities = (topic.activities || [])
        .slice()
        .sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0))
        .map(renderActivity)
        .join("");

    return `
        <article class="content-card topic-card">
            <button
                class="topic-toggle"
                type="button"
                aria-expanded="false"
                aria-controls="${panelId}"
            >
                <span class="topic-card-content">
                    <span class="topic-label">
                        ${escapeHTML(topic.level)} Learning Topic
                    </span>
                    <h2>${escapeHTML(topic.title)}</h2>
                    <p>${escapeHTML(topic.description)}</p>
                    <span class="topic-outcome">
                        <strong>Learning outcome:</strong>
                        ${escapeHTML(topic.learning_outcome)}
                    </span>
                </span>
                <span class="topic-arrow" aria-hidden="true">＋</span>
            </button>
            <div class="topic-activities" id="${panelId}" hidden>
                <h3>Activities</h3>
                <div class="activity-grid">${activities}</div>
            </div>
        </article>
    `;
}

async function loadContentBank(level, containerId = "content-bank") {
    const container = document.getElementById(containerId);
    if (!container || !level) return;

    container.setAttribute("aria-busy", "true");
    container.innerHTML =
        `<p role="status">Loading learning resources...</p>`;

    try {
        const response = await fetch(CONTENT_BANK_URL);
        if (!response.ok) {
            throw new Error(`Could not load the content bank (${response.status}).`);
        }

        const data = await response.json();
        const wanted = String(level).toUpperCase();
        const topics = (Array.isArray(data.topics) ? data.topics : []).filter(
            topic => String(topic.level || "").toUpperCase() === wanted
        );

        if (topics.length === 0) {
            container.innerHTML =
                `<p>Learning activities for this level are coming soon.</p>`;
            return;
        }

        container.innerHTML = topics
            .map((topic, index) => renderTopic(topic, index, containerId))
            .join("");

        // One listener for all topics (event delegation)
        container.onclick = event => {
            const button = event.target.closest(".topic-toggle");
            if (!button || !container.contains(button)) return;

            const panel = document.getElementById(
                button.getAttribute("aria-controls")
            );
            if (!panel) return;

            const isExpanded = button.getAttribute("aria-expanded") === "true";
            button.setAttribute("aria-expanded", String(!isExpanded));
            panel.hidden = isExpanded;
            button.querySelector(".topic-arrow").textContent =
                isExpanded ? "＋" : "−";
        };
    } catch (error) {
        console.error("Content bank error:", error);
        container.innerHTML = `
            <p role="alert">
                Learning resources could not be loaded.
                Please try again later.
            </p>
        `;
    } finally {
        container.removeAttribute("aria-busy");
    }
}
