const staticData = {
    countries: [
        { name: "Nepal", center: [28.3949, 84.124], zoom: 7 },
        { name: "Bangladesh", center: [23.685, 90.3563], zoom: 7 }
    ],
    capitals: [
        { id: "human", name: "Human Capital", color: "#3B82F6", description: "Skills, knowledge, and health that enable people to work and pursue their goals. Includes education, health access, and labor productivity." },
        { id: "social", name: "Social Capital", color: "#10B981", description: "Networks, relationships, and trust that facilitate cooperation and collective action. Includes community groups, social safety nets, and governance." },
        { id: "physical", name: "Physical Capital", color: "#EF4444", description: "Basic infrastructure and producer goods needed to support livelihoods. Includes transportation, housing quality, water supply, and energy." },
        { id: "financial", name: "Financial Capital", color: "#F59E0B", description: "Financial resources that people use to achieve their livelihood objectives. Includes income stability, access to credit, and savings." },
        { id: "natural", name: "Natural Capital", color: "#8B5CF6", description: "Natural resource stocks and ecosystem services from which resource flows and services useful for livelihoods are derived. Includes land quality and resource management." }
    ],
    indicators: {
        human: [
            { id: "h1", name: "Health Access" },
            { id: "h2", name: "Education Level" }
        ],
        social: [
            { id: "s1", name: "Community Groups" },
            { id: "s2", name: "Social Safety Nets" }
        ],
        physical: [
            { id: "p1", name: "Infrastructure" },
            { id: "p2", name: "Housing Quality" }
        ],
        financial: [
            { id: "f1", name: "Income Stability" },
            { id: "f2", name: "Access to Credit" }
        ],
        natural: [
            { id: "n1", name: "Resource Management" },
            { id: "n2", name: "Land Quality" }
        ]
    }
};

const GRADE_VALUES = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
