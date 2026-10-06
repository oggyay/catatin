package com.example.catatin.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val CatatinColorScheme = lightColorScheme(
    primary = CatatinColors.Primary,
    onPrimary = Color.White,
    primaryContainer = CatatinColors.PrimaryContainer,
    onPrimaryContainer = CatatinColors.Primary,
    secondary = CatatinColors.Success,
    onSecondary = Color.White,
    secondaryContainer = CatatinColors.SuccessContainer,
    onSecondaryContainer = CatatinColors.Success,
    tertiary = CatatinColors.Warning,
    onTertiary = Color.White,
    tertiaryContainer = CatatinColors.WarningContainer,
    onTertiaryContainer = CatatinColors.Warning,
    error = CatatinColors.Danger,
    onError = Color.White,
    errorContainer = CatatinColors.DangerContainer,
    onErrorContainer = CatatinColors.Danger,
    background = CatatinColors.Background,
    onBackground = CatatinColors.TextPrimary,
    surface = CatatinColors.Surface,
    onSurface = CatatinColors.TextPrimary,
    surfaceVariant = CatatinColors.SurfaceVariant,
    onSurfaceVariant = CatatinColors.TextSecondary,
    outline = CatatinColors.Border,
    outlineVariant = CatatinColors.Border
)

@Composable
fun CatatINTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = CatatinColorScheme,
        typography = CatatinTypography,
        content = content
    )
}
