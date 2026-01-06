module.exports = {
    apps: [
        {
            name: "zap-entregas",
            script: "npm",
            args: "start -- -p 4000",
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};
