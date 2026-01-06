module.exports = {
    apps: [
        {
            name: "zap-entregas",
            script: "npm",
            args: "start",
            env: {
                PORT: 4000, // Running on 4000 to avoid conflict with other app on 3000
                NODE_ENV: "production"
            }
        }
    ]
};
