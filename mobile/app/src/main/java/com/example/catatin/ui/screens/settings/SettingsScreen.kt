package com.example.catatin.ui.screens.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import com.example.catatin.ui.screens.auth.AuthViewModel
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateToProfile: () -> Unit,
    onNavigateToWhatsapp: () -> Unit,
    onNavigateToUsers: () -> Unit,
    onNavigateToSubscription: () -> Unit,
    onLogoutSuccess: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SettingsViewModel = koinViewModel(),
    authViewModel: AuthViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showLogoutConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            CatatinTopBar(title = "Pengaturan")
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
                    val isUmkm = state.tenantSettings.type == "umkm"

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // User Profile Header Info
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.AccountCircle,
                                        contentDescription = null,
                                        tint = CatatinColors.Primary,
                                        modifier = Modifier.size(56.dp)
                                    )
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column {
                                        Text(
                                            text = state.profile.name,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 18.sp,
                                            color = CatatinColors.TextPrimary
                                        )
                                        Text(
                                            text = "+" + state.profile.whatsappNumber,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = CatatinColors.TextSecondary
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        BadgeChip(
                                            text = if (isUmkm) "UMKM / Bisnis" else "Pribadi",
                                            color = CatatinColors.Primary,
                                            bgColor = CatatinColors.PrimaryLight
                                        )
                                    }
                                }
                            }
                        }

                        // Options Group
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Column {
                                    SettingsItem(
                                        icon = Icons.Default.Person,
                                        title = "Ubah Profil",
                                        subtitle = "Nama dan nomor telepon WhatsApp Anda",
                                        onClick = onNavigateToProfile
                                    )
                                    HorizontalDivider(color = CatatinColors.Border)
                                    SettingsItem(
                                        icon = Icons.Default.Chat,
                                        title = "WhatsApp Bot",
                                        subtitle = "Hubungkan bot pencatatan otomatis WhatsApp",
                                        onClick = onNavigateToWhatsapp
                                    )
                                    if (isUmkm) {
                                        HorizontalDivider(color = CatatinColors.Border)
                                        SettingsItem(
                                            icon = Icons.Default.People,
                                            title = "Kelola Anggota",
                                            subtitle = "Tambah/hapus karyawan atau kasir bisnis",
                                            onClick = onNavigateToUsers
                                        )
                                    }
                                    HorizontalDivider(color = CatatinColors.Border)
                                    SettingsItem(
                                        icon = Icons.Default.Star,
                                        title = "Informasi Berlangganan",
                                        subtitle = "Detail paket, batas kuota saldo, dan penggunaan",
                                        onClick = onNavigateToSubscription
                                    )
                                }
                            }
                        }

                        // Logout button
                        item {
                            Button(
                                onClick = { showLogoutConfirm = true },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = CatatinColors.DangerContainer,
                                    contentColor = CatatinColors.Danger
                                )
                            ) {
                                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Keluar dari Akun", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Logout Confirmation
        if (showLogoutConfirm) {
            ConfirmDialog(
                title = "Keluar Akun",
                message = "Apakah Anda yakin ingin keluar dari akun CatatIN Anda?",
                confirmText = "Keluar",
                dismissText = "Batal",
                isDestructive = true,
                onConfirm = {
                    authViewModel.logout {
                        showLogoutConfirm = false
                        onLogoutSuccess()
                    }
                },
                onDismiss = { showLogoutConfirm = false }
            )
        }
    }
}

@Composable
fun SettingsItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = CatatinColors.Primary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = CatatinColors.TextPrimary)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = CatatinColors.TextSecondary)
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
            tint = CatatinColors.TextMuted,
            modifier = Modifier.size(16.dp)
        )
    }
}
