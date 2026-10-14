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
        const items = data.content.filter(
            item => item.level.toUpperCase() === level.toUpperCase()
        );
        if (items.length === 0) {
            container.innerHTML = "<p>New learning resources are coming soon.</p>";
            return;
        }
        container.innerHTML = items.map(item => `
            <article class="content-card">
                <span class="content-skill">${item.skill}</span>
                <h3>${item.title}</h3>
                <p>${item.description}</p>
                ${
                    item.url
                        ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">Open resource</a>`
                        : `<span class="content-coming-soon">Coming soon</span>`
                }
            </article>
        `).join("");
    } catch (error) {
        console.error(error);
        container.innerHTML = "<p>Resources could not be loaded. Please try again later.</p>";
    }
}
