// src/theme/index.tsx
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import 'dayjs/locale/pt-br';
import { useMemo, useState } from "react";
import { ThemeModeContext, type ThemeMode, type ThemeModeContextValue } from "./theme-mode";
import {
    darkThemes,
    DEFAULT_DARK_THEME_ID,
    DEFAULT_LIGHT_THEME_ID,
    getThemeById,
    lightThemes,
} from "./themes";

function readSavedTheme(mode: ThemeMode): string {
  const key = `theme-${mode}-id`;
  const saved = localStorage.getItem(key);
  const definition = saved ? getThemeById(saved) : undefined;
  if (definition?.mode === mode) return definition.id;
  const fallback = mode === "light" ? DEFAULT_LIGHT_THEME_ID : DEFAULT_DARK_THEME_ID;
  if (saved) localStorage.setItem(key, fallback);
  return fallback;
}

export function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const getInitialMode = (): ThemeMode => {
    const saved = localStorage.getItem("theme-mode") as ThemeMode | null;
    if (saved === "light" || saved === "dark") return saved;

    return "dark";
  };

  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode());

  const [lightThemeId, setLightThemeIdState] = useState<string>(
    () => readSavedTheme("light"),
  );

  const [darkThemeId, setDarkThemeIdState] = useState<string>(
    () => readSavedTheme("dark"),
  );

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("theme-mode", next);
      return next;
    });
  };

  const setLightTheme = (id: string) => {
    setLightThemeIdState(id);
    localStorage.setItem("theme-light-id", id);
    setMode("light");
    localStorage.setItem("theme-mode", "light");
  };

  const setDarkTheme = (id: string) => {
    setDarkThemeIdState(id);
    localStorage.setItem("theme-dark-id", id);
    setMode("dark");
    localStorage.setItem("theme-mode", "dark");
  };

  const theme = useMemo(() => {
    const id = mode === "light" ? lightThemeId : darkThemeId;
    const def = getThemeById(id);
    if (def) return def.theme;
    return mode === "light" ? lightThemes[0].theme : darkThemes[0].theme;
  }, [mode, lightThemeId, darkThemeId]);

  const ctx = useMemo<ThemeModeContextValue>(
    () => ({ mode, toggleTheme, lightThemeId, darkThemeId, setLightTheme, setDarkTheme }),
    [mode, lightThemeId, darkThemeId],
  );

  return (
    <ThemeModeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        {/* `enableColorScheme` escreve `color-scheme: dark` na raiz quando o
            tema é escuro. Sem isso o navegador desenha as barras de rolagem
            no esquema claro — uma faixa cinza-clara colada na lateral de uma
            tela escura, em toda área que rola. */}
        <CssBaseline enableColorScheme />
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
