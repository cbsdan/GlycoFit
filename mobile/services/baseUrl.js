const environments = {
  development: {
    // deviceLocal: "http://192.168.100.12:4000/api/v1",
    deviceLocal: "http://192.168.100.135:4000/api/v1",
  },
  production: "https://glycofit.com/api",
};

const getBaseUrl = () => {
  const isDev = __DEV__;

  if (isDev) {
    return environments.development.deviceLocal;
  } else {
    return environments.production;
  }
};

const baseURL = getBaseUrl();

export default baseURL;
