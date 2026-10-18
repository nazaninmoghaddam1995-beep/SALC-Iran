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
            topic => topic.level &&
                topic.level.toUpperCase() === level.toUpperCase()
        );
        if (topics.length === 0) {
            container.innerHTML =
                "<p>Learning activities for this level are coming soon.</p>";
            return;
        }
        container.innerHTML = topics.map((topic, index) => `
            <article class="content-card topic-card">
                <button
                    class="topic-toggle"
                    type="button"
                    aria-expanded="false"
                    aria-controls="topic-activities-${index}"
                >
                    <span class="topic-card-content">
                        <span class="topic-label">A1 Learning Topic</span>
                        <h2>${topic.title}</h2>
                        <p>${topic.description}</p>
                        <span class="topic-outcome">
                            <strong>Learning outcome:</strong>
                            ${topic.learning_outcome}
                        </span>
                    </span>
                    <span class="topic-arrow" aria-hidden="true">＋</span>
                </button>
                <div
                    class="topic-activities"
                    id="topic-activities-${index}"
                    hidden
                >
                    <h3>Activities</h3>
                    <div class="activity-grid">
                        ${(topic.activities || [])
                            .slice()
                            .sort((a, b) => a.stage - b.stage)
                            .map(activity => `
                                <article class="activity-item">
                                    <span class="content-skill">
                                        Step ${activity.stage} · ${activity.skill}
                                    </span>
                                    <h4>${activity.title}</h4>
                                    <p>${activity.description}</p>
                                    ${
                                        activity.status === "available" && activity.url
                                            ? `<a class="check-button"
                                                  href="${activity.url}">
                                                  Start Activity →
                                               </a>`
                                            : `<span class="content-coming-soon">
                                                  Coming soon
                                               </span>`
                                    }
                                </article>
                            `).join("")}
                    </div>
                </div>
            </article>
        `).join("");
        container.querySelectorAll(".topic-toggle").forEach(button => {
            button.addEventListener("click", () => {
                const panel = document.getElementById(
                    button.getAttribute("aria-controls")
                );
                const isExpanded =
                    button.getAttribute("aria-expanded") === "true";
                button.setAttribute(
                    "aria-expanded",
                    String(!isExpanded)
                );
                panel.hidden = isExpanded;
                button.querySelector(".topic-arrow").textContent =
                    isExpanded ? "＋" : "−";
            });
        });
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
