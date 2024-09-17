import neo4j from 'neo4j-driver';

export const createDriver = async (config: any) => {
  const driver = neo4j.driver(
    `${config.scheme}://${config.host}:${config.port}`,
    neo4j.auth.basic(config.username, config.password),
  );
  await driver.getServerInfo();
  return driver;
};
