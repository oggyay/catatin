package com.example.catatin.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsWhatsappScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SettingsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var isSubmitting by remember { mutableStateOf(false) }
    var actionError by remember { mutableStateOf<String?>(null) }
    var showUnlinkConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "WhatsApp Bot",
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
                    val wa = state.whatsapp

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Header Intro Card
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Chat,
                                        contentDescription = null,
                                        tint = Color(0xFF25D366), // WA Green
                                        modifier = Modifier.size(64.dp)
                                    )
                                    Text(
                                        "Catat Otomatis Lewat WhatsApp",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                        textAlign = TextAlign.Center
                                    )
                                    Text(
                                        "Fitur integrasi WhatsApp memungkinkan Anda mencatat transaksi keuangan secara instan hanya dengan mengirim pesan teks ke Bot CatatIN.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = CatatinColors.TextSecondary,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }

                        // Connection Status Card
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Text("Status Koneksi", fontWeight = FontWeight.Bold, fontSize = 15.sp)

                                    actionError?.let {
                                        Text(it, color = CatatinColors.Danger, style = MaterialTheme.typography.bodySmall)
                                    }

                                    if (wa.linked) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text("Nomor Terhubung", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                Text("+" + (wa.whatsappNumber ?: ""), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                            }
                                            BadgeChip("Terhubung", CatatinColors.Success, CatatinColors.SuccessLight)
                                        }

                                        Spacer(modifier = Modifier.height(12.dp))

                                        Button(
                                            onClick = { showUnlinkConfirm = true },
                                            modifier = Modifier.fillMaxWidth().height(48.dp),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = CatatinColors.DangerContainer, contentColor = CatatinColors.Danger),
                                            enabled = !isSubmitting
                                        ) {
                                            Text("Putuskan Hubungan Bot", fontWeight = FontWeight.Bold)
                                        }
                                    } else {
                                        val activeReq = wa.activeRequest
                                        if (activeReq != null) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column {
                                                    Text("Menunggu Konfirmasi", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                    Text("+" + activeReq.whatsappNumber, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                                }
                                                BadgeChip("Pending", CatatinColors.Warning, CatatinColors.WarningLight)
                                            }

                                            Card(
                                                modifier = Modifier.fillMaxWidth(),
                                                colors = CardDefaults.cardColors(containerColor = CatatinColors.WarningContainer)
                                            ) {
                                                Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                                    Icon(Icons.Default.Info, null, tint = CatatinColors.Warning)
                                                    Spacer(modifier = Modifier.width(8.dp))
                                                    Text(
                                                        "Silakan kirim pesan apa saja ke nomor Bot WhatsApp CatatIN untuk memverifikasi tautan.",
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = CatatinColors.Warning
                                                    )
                                                }
                                            }

                                            Spacer(modifier = Modifier.height(12.dp))

                                            OutlinedButton(
                                                onClick = {
                                                    isSubmitting = true
                                                    viewModel.cancelWhatsappLink(
                                                        onSuccess = { isSubmitting = false },
                                                        onError = {
                                                            isSubmitting = false
                                                            actionError = it
                                                        }
                                                    )
                                                },
                                                modifier = Modifier.fillMaxWidth().height(48.dp),
                                                shape = RoundedCornerShape(12.dp),
                                                enabled = !isSubmitting
                                            ) {
                                                Text("Batalkan Permintaan Tautan")
                                            }
                                        } else {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text("Status", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                BadgeChip("Belum Terhubung", CatatinColors.TextMuted, CatatinColors.SurfaceVariant)
                                            }

                                            Spacer(modifier = Modifier.height(12.dp))

                                            Button(
                                                onClick = {
                                                    isSubmitting = true
                                                    viewModel.requestWhatsappLink(
                                                        onSuccess = { isSubmitting = false },
                                                        onError = {
                                                            isSubmitting = false
                                                            actionError = it
                                                        }
                                                    )
                                                },
                                                modifier = Modifier.fillMaxWidth().height(48.dp),
                                                shape = RoundedCornerShape(12.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366)), // WhatsApp Green
                                                enabled = !isSubmitting
                                            ) {
                                                Text("Hubungkan Akun WhatsApp", fontWeight = FontWeight.Bold, color = Color.White)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Unlink Confirm Dialog
        if (showUnlinkConfirm) {
            ConfirmDialog(
                title = "Putuskan WhatsApp Bot",
                message = "Apakah Anda yakin ingin memutuskan hubungan WhatsApp Bot? Anda tidak akan dapat mencatat transaksi lewat WhatsApp lagi.",
                confirmText = "Putuskan",
                dismissText = "Batal",
                isDestructive = true,
                onConfirm = {
                    isSubmitting = true
                    viewModel.unlinkWhatsapp(
                        onSuccess = {
                            isSubmitting = false
                            showUnlinkConfirm = false
                        },
                        onError = {
                            isSubmitting = false
                            showUnlinkConfirm = false
                            actionError = it
                        }
                    )
                },
                onDismiss = { showUnlinkConfirm = false }
            )
        }
    }
}
