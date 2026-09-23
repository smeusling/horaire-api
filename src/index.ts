import Fastify from "fastify";

const fastify = Fastify();

fastify.get("/health", async () => {
  return { status: "ok" };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log("Serveur démarré sur http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
