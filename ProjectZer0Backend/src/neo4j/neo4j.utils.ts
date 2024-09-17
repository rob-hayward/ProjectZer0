import neo4j, { Driver } from 'neo4j-driver';

export const createDriver = async (config: any): Promise<Driver> => {
  const driver = neo4j.driver(
    `${config.scheme}://${config.host}:${config.port}`,
    neo4j.auth.basic(config.username, config.password),
    // Remove the encryption configuration here
  );

  try {
    const serverInfo = await driver.getServerInfo();
    console.log('Driver created successfully. Server info:', serverInfo);
    return driver;
  } catch (error) {
    console.error('Error creating driver:', error);
    await driver.close();
    throw error;
  }
};
