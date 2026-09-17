module.exports = {
    uiPort: process.env.PORT || 1880,
    flowFile: "flows.json",
    credentialSecret: false,
    editorTheme: {
        projects: {
            enabled: false,
        },
    },
    functionExternalModules: false,
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false,
        },
    },
};
