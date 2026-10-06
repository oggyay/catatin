package com.example.catatin.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSubscriptionScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SettingsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "Informasi Paket",
                onBack = onBack
            )
        },
        containerColor = CatatinColors.Background,
        modifier = modifier
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is SettingsUiState.Loading -> LoadingState()
                is SettingsUiState.Error -> ErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadSettingsData() }
                )
                is SettingsUiState.Success -> {
                    val sub = state.subscription
                    val planName = when (sub.tenant.subscriptionPlan.lowercase()) {
                        "free" -> "Free Trial (Uji Coba Gratis)"
                        "pro" -> "Pro (Pelaku Usaha)"
                        "enterprise" -> "Enterprise (Bisnis Menengah)"
                        else -> sub.tenant.subscriptionPlan.uppercase()
                    }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Plan Detail Box
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = CatatinColors.DarkBg),
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                            ) {
                                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        "PAKET AKTIF ANDA",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = CatatinColors.TextMuted,
                                        letterSpacing = 1.sp
                                    )
                                    Text(
                                        planName,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 22.sp,
                                        color = Color.White
                                    )
                                    Text(
                                        "Masa aktif trial berlaku selamanya untuk personal. Fitur UMKM memerlukan upgrade paket.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = CatatinColors.TextMuted
                                    )
                                }
                            }
                        }

                        // Usage Limits
                        item {
                            Text(
                                "Penggunaan Kuota",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = CatatinColors.TextPrimary
                            )
                        }

                        // Accounts limit card
                        item {
                            val accUsage = sub.usage.accounts
                            val accLimit = sub.limits.maxAccounts
                            val accProgress = if (accLimit > 0) accUsage.toFloat() / accLimit.toFloat() else 0f
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Kuota Rekening / Dompet", fontWeight = FontWeight.SemiBold)
                                        Text("$accUsage / $accLimit Rekening", fontWeight = FontWeight.Bold, color = CatatinColors.Primary)
                                    }
                                    LinearProgressIndicator(
                                        progress = { accProgress },
                                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                                        color = if (accProgress >= 1f) CatatinColors.Danger else CatatinColors.Primary,
                                        trackColor = CatatinColors.PrimaryLight
                                    )
                                }
                            }
                        }

                        // Users limit card
                        item {
                            val usersUsage = sub.usage.users
                            val usersLimit = sub.limits.maxUsers
                            val usersProgress = if (usersLimit > 0) usersUsage.toFloat() / usersLimit.toFloat() else 0f
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Kuota Anggota Tim", fontWeight = FontWeight.SemiBold)
                                        Text("$usersUsage / $usersLimit Anggota", fontWeight = FontWeight.Bold, color = CatatinColors.Primary)
                                    }
                                    LinearProgressIndicator(
                                        progress = { usersProgress },
                                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                                        color = if (usersProgress >= 1f) CatatinColors.Danger else CatatinColors.Primary,
                                        trackColor = CatatinColors.PrimaryLight
                                    )
                                }
                            }
                        }

                        // Features List
                        item {
                            Text(
                                "Fitur Paket",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = CatatinColors.TextPrimary
                            )
                        }

                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    FeatureRow(label = "Ekspor Laporan Keuangan", isEnabled = true)
                                    FeatureRow(label = "Multi-device Sinkronisasi", isEnabled = true)
                                    FeatureRow(label = "WhatsApp Integration Bot", isEnabled = sub.limits.whatsappBot)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun FeatureRow(label: String, isEnabled: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (isEnabled) Icons.Default.CheckCircle else Icons.Default.ErrorOutline,
            contentDescription = null,
            tint = if (isEnabled) CatatinColors.Success else CatatinColors.TextMuted,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = if (isEnabled) CatatinColors.TextPrimary else CatatinColors.TextMuted
        )
    }
}
