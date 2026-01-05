const environments = {
  development: {
    deviceLocal: "http://192.168.83.77:4000/api/v1",
  },
  production: "https://glycofit.onrender.com/api/v1",
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
