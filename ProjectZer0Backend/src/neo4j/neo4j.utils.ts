import neo4j, { Driver } from 'neo4j-driver';

export const createDriver = async (config: any): Promise<Driver> => {
  const driver = neo4j.driver(
    `${config.scheme}://${config.host}:${config.port}`,
    neo4j.auth.basic(config.username, config.password),
  );

  try {
    await driver.verifyConnectivity();
    return driver;
  } catch (error) {
    await driver.close();
    throw error;
  }
};
