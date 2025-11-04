const environments = {
  development: {
    deviceLocal: "http://10.158.216.243:4000/api/v1",
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
