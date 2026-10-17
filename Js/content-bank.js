async function loadContentBank(level, containerId = "content-bank") {
const container = document.getElementById(containerId);

if (!container) {
    return;
}
container.innerHTML = "<p>Loading learning resources...</p>";
try {
    const response = await fetch("../data/content-bank.json");
    if (!response.ok) {
        throw new Error("Could not load the content bank.");
    }
    const data = await response.json();
    const topics = (data.topics || []).filter(
        topic => topic.level.toUpperCase() === level.toUpperCase()
    );
    if (topics.length === 0) {
        container.innerHTML =
            "<p>Learning activities for this level are coming soon.</p>";
        return;
    }
    container.innerHTML = topics.map(topic => `
    <section class="topic-section">
        <header class="topic-header">
            <h2>${topic.title}</h2>
            <p>${topic.description}</p>

            <div class="learning-outcome">
                <strong>Learning outcome:</strong>
                ${topic.learning_outcome}
            </div>
        </header>

        <div class="activity-grid">
            ${(topic.activities || [])
                .slice()
                .sort((a, b) => a.stage - b.stage)
                .map(activity => `
                    <article class="content-card">
                        <span class="content-skill">
                            Step ${activity.stage} · ${activity.skill}
                        </span>

                        <h3>${activity.title}</h3>
                        <p>${activity.description}</p>

                        ${
                            activity.status === "available" && activity.url
                                ? `<a class="check-button" href="${activity.url}">
                                      Start Activity →
                                   </a>`
                                : `<span class="content-coming-soon">
                                      Coming soon
                                   </span>`
                        }
                    </article>
                `).join("")}
        </div>
    </section>
`).join("");}
            </div>
        </section>
    `).join("");
} catch (error) {
    console.error("Content bank error:", error);
    container.innerHTML = `
        <p>
            Learning resources could not be loaded.
            Please try again later.
        </p>
    `;
}

}
