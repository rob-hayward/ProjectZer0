import neo4j, { Driver } from 'neo4j-driver';

export const createDriver = async (config: any): Promise<Driver> => {
  console.log('Neo4j configuration:', {
    uri: config.uri,
    username: config.username,
    password: config.password ? '[REDACTED]' : undefined,
  });

  if (!config.uri) {
    throw new Error(
      'Neo4j URI is not defined in the configuration. Please check your .env file and ensure NEO4J_URI is set.',
    );
  }
  if (!config.username) {
    throw new Error(
      'Neo4j username is not defined in the configuration. Please check your .env file and ensure NEO4J_USERNAME is set.',
    );
  }
  if (!config.password) {
    throw new Error(
      'Neo4j password is not defined in the configuration. Please check your .env file and ensure NEO4J_PASSWORD is set.',
    );
  }

  const driver = neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.username, config.password),
  );

  try {
    await driver.verifyConnectivity();
    console.log('Successfully connected to Neo4j');
    return driver;
  } catch (error) {
    console.error('Failed to connect to Neo4j:', error);
    await driver.close();
    throw new Error(`Failed to connect to Neo4j: ${error.message}`);
  }
};
