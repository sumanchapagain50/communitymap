const staticData = {
    countries: [
        { name: "Nepal", center: [28.3949, 84.124], zoom: 9 }
    ],
    capitals: [
        { id: "human", name: "Human Capital", color: "#3B82F6", description: "Skills, knowledge, and health that enable people to work and pursue their goals. Includes education, health access, and labor productivity." },
        { id: "social", name: "Social Capital", color: "#10B981", description: "Networks, relationships, and trust that facilitate cooperation and collective action. Includes community groups, social safety nets, and governance." },
        { id: "physical", name: "Physical Capital", color: "#EF4444", description: "Basic infrastructure and producer goods needed to support livelihoods. Includes transportation, housing quality, water supply, and energy." },
        { id: "financial", name: "Financial Capital", color: "#F59E0B", description: "Financial resources that people use to achieve their livelihood objectives. Includes income stability, access to credit, and savings." },
        { id: "natural", name: "Natural Capital", color: "#8B5CF6", description: "Natural resource stocks and ecosystem services from which resource flows and services useful for livelihoods are derived. Includes land quality and resource management." }
    ],
    indicators: {
        financial: [
            { id: "F01", name: "Household access to discretionary funds" },
            { id: "F02", name: "Community financial health" },
            { id: "F03", name: "Local government financial capacity" },
            { id: "F04", name: "Public infrastructure maintenance budget" },
            { id: "F05", name: "Climate change adaptation planning and investment" },
            { id: "F06", name: "Business continuity during floods" },
            { id: "F07", name: "Business continuity during heatwave" },
            { id: "F08", name: "Household income continuity during flood" },
            { id: "F09", name: "Household income continuity during heatwave" },
            { id: "F10", name: "Flood risk reduction investment" },
            { id: "F11", name: "Heatwave risk reduction investment" },
            { id: "F12", name: "Disaster insurance" },
            { id: "F13", name: "Disaster recovery budget" },
            { id: "F14", name: "Energy affordibility" },
            { id: "F15", name: "Heatwave action-plan budget" }
        ],
        human: [
            { id: "H01", name: "Secondary school attendance" },
            { id: "H02", name: "Food availability" },
            { id: "H03", name: "First aid knowledge" },
            { id: "H04", name: "Awareness of the need for climate change action" },
            { id: "H05", name: "Awarenss of climate change risk on floods" },
            { id: "H06", name: "Awarenss of climate change risk on heatwaves" },
            { id: "H07", name: "Awareness of how nature mitigates risk during floods" },
            { id: "H08", name: "Awareness of how nature mitigates risk during heatwaves" },
            { id: "H09", name: "Hazard exposure awareness" },
            { id: "H10", name: "Hazard vulnerability awareness" },
            { id: "H11", name: "Evacuation and safety knowledge" },
            { id: "H12", name: "Unsafe water awareness" },
            { id: "H13", name: "Heatwave protection knowledge" },
            { id: "H14", name: "Worker protection for heatwaves" }
        ],
        natural: [
            { id: "N01", name: "Tree cover" },
            { id: "N02", name: "Permeable surfaces" },
            { id: "N03", name: "Land use planning" },
            { id: "N04", name: "Resource management" },
            { id: "N05", name: "Land/water interface health" },
            { id: "N06", name: "Ecological management for flood disaster risk reduction" },
            { id: "N07", name: "Ecological management for heatwave disaster risk reduction" }
        ],
        physical: [
            { id: "P01", name: "Energy supply continuity" },
            { id: "P02", name: "Transportation system continuity" },
            { id: "P03", name: "Communication systems continuity" },
            { id: "P04", name: "Flood early warning" },
            { id: "P05", name: "Heatwave early warning" },
            { id: "P06", name: "Continuity of education during floods" },
            { id: "P07", name: "Continuity of education during heatwaves" },
            { id: "P08", name: "Emergency infrastructure and supplies during floods" },
            { id: "P09", name: "Emergency infrastructure and supplies during heatwaves" },
            { id: "P10", name: "Continuity of healthcare during disaster during floods" },
            { id: "P11", name: "Continuity of healthcare during disaster during heatwaves" },
            { id: "P12", name: "Forecasting for floods" },
            { id: "P13", name: "Forecasting for heatwaves" },
            { id: "P14", name: "Household protection and adaptation on floods" },
            { id: "P15", name: "Household protection and adaptation on heatwaves" },
            { id: "P16", name: "Availability of clean, safe water during floods" },
            { id: "P17", name: "Availability of clean, safe water during heatwaves" },
            { id: "P18", name: "Waste management and risk" },
            { id: "P19", name: "Large scale flood protection" }
        ],
        social: [
            { id: "S01", name: "Mutual support" },
            { id: "S02", name: "Social inclusiveness of disaster risk management" },
            { id: "S03", name: "Community safety" },
            { id: "S04", name: "Local leadership" },
            { id: "S05", name: "Disaster response personnel" },
            { id: "S06", name: "Healthcare accessibility" },
            { id: "S07", name: "Trust in local authorities" },
            { id: "S08", name: "Intra-community equity" },
            { id: "S09", name: "Inter-community equity" },
            { id: "S10", name: "Risk reduction planning for floods" },
            { id: "S11", name: "Risk reduction planning for heatwaves" },
            { id: "S12", name: "Response planning for floods" },
            { id: "S13", name: "Response planning for heatwaves" },
            { id: "S14", name: "Family violence and response planning during floods" },
            { id: "S15", name: "Family violence and response planning during heatwaves" },
            { id: "S16", name: "Stakeholder engagement in risk management for floods" },
            { id: "S17", name: "Stakeholder engagement in risk management for heatwaves" },
            { id: "S18", name: "Flood risk mapping" },
            { id: "S19", name: "Heatwave risk mapping" },
            { id: "S20", name: "Flood disaster impact data collection and use" },
            { id: "S21", name: "Heatwave disaster impact data collection and use" }
        ]
    }
};

