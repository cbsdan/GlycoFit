export const COMMON_COLORS = {
  primary: "#0066B1",
  secondary: "#FFFFFF",
  error: "#FF4444",
  success: "#00C851",
  warning: "#FFBB33",
  info: "#2196F3",
  starColor: "#FFD700",
};

// Font configuration
export const FONTS = {
  sizes: {
    small: 12,
    medium: 16,
    large: 20,
    xlarge: 24,
  },
  weights: {
    light: "300",
    regular: "400",
    medium: "500",
    bold: "700",
  },
};

export const lightTheme = {
  background: "#ffffff",
  text: "#000000",
  primary: COMMON_COLORS.primary,
  secondary: "#777777",
  accent: "#ff6600",
  surface: "#f5f5f5",
  card: "#ffffff",
  border: "#dddddd",
  borderCars: "#dddddd",
  buttonBackground: "#ddd",
  buttonText: "#000000",
  statusBar: "dark",
  success: COMMON_COLORS.success,
  error: COMMON_COLORS.error,
  warning: COMMON_COLORS.warning,
  info: COMMON_COLORS.info,
  // Toast specific colors
  toast: {
    success: COMMON_COLORS.success,
    error: COMMON_COLORS.error,
    warning: COMMON_COLORS.warning,
    info: COMMON_COLORS.info,
    text: "#FFFFFF",
  },
  // Navigation specific
  tabBarBackground: "#ffffff",
  tabBarActive: COMMON_COLORS.primary,
  tabBarInactive: "#757575",
  tabBarBorder: "#e0e0e0",
  headerBackground: "#ffffff",
  headerText: "#000000",
  // Input fields
  inputBackground: "#f9f9f9",
  inputText: "#333333",
  inputBorder: "#cccccc",
  inputPlaceholder: "#999999",
  // Card shadows
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // Add fonts to theme to prevent undefined errors
  fonts: FONTS,
};

export const darkTheme = {
  background: "#121212",
  text: "#ffffff",
  primary: "#0259b0", // Lighter blue for dark mode
  secondary: "#a0a0a0",
  accent: "#ff9900",
  surface: "#1e1e1e",
  card: "#2c2c2c",
  border: "#444444",
  borderCars: "#ffffff",
  buttonBackground: "#444",
  buttonText: "#ffffff",
  statusBar: "light",
  success: COMMON_COLORS.success,
  error: COMMON_COLORS.error,
  warning: COMMON_COLORS.warning,
  info: COMMON_COLORS.info, // Added info color
  // Toast specific colors
  toast: {
    success: COMMON_COLORS.success,
    error: COMMON_COLORS.error,
    warning: COMMON_COLORS.warning,
    info: COMMON_COLORS.info,
    text: "#FFFFFF",
  },
  // Navigation specific
  tabBarBackground: "#1e1e1e",
  tabBarActive: "#3399ff",
  tabBarInactive: "#9e9e9e",
  tabBarBorder: "#333333",
  headerBackground: "#1e1e1e",
  headerText: "#ffffff",
  // Input fields
  inputBackground: "#333333",
  inputText: "#ffffff",
  inputBorder: "#555555",
  inputPlaceholder: "#777777",
  // Card shadows
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // Add fonts to theme to prevent undefined errors
  fonts: FONTS,
};

// Helper function to get theme based on mode
export const getThemeColors = (isDarkMode) => {
  return isDarkMode ? darkTheme : lightTheme;
};
