package com.example.catatin.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsProfileScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SettingsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var name by remember { mutableStateOf("") }
    var whatsappNumber by remember { mutableStateOf("") }
    var initialLoadDone by remember { mutableStateOf(false) }

    var isSubmitting by remember { mutableStateOf(false) }
    var actionError by remember { mutableStateOf<String?>(null) }
    var showSuccessSnackbar by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "Ubah Profil",
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
                    if (!initialLoadDone) {
                        name = state.profile.name
                        whatsappNumber = state.profile.whatsappNumber
                        initialLoadDone = true
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        if (showSuccessSnackbar) {
                            Surface(
                                color = CatatinColors.SuccessLight,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    "Profil berhasil disimpan!",
                                    color = CatatinColors.Success,
                                    modifier = Modifier.padding(12.dp),
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        actionError?.let {
                            Surface(
                                color = CatatinColors.DangerLight,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    it,
                                    color = CatatinColors.Danger,
                                    modifier = Modifier.padding(12.dp),
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Nama Lengkap") },
                            placeholder = { Text("Contoh: Ahmad Fauzi") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = whatsappNumber,
                            onValueChange = { whatsappNumber = it },
                            label = { Text("Nomor WhatsApp") },
                            placeholder = { Text("Contoh: 6281234567890") },
                            leadingIcon = { Icon(Icons.Default.Phone, null, tint = CatatinColors.Primary) },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.weight(1f))

                        Button(
                            onClick = {
                                if (name.isBlank() || whatsappNumber.isBlank()) {
                                    actionError = "Nama dan Nomor WhatsApp tidak boleh kosong"
                                    return@Button
                                }
                                isSubmitting = true
                                viewModel.updateProfile(
                                    name = name,
                                    phone = whatsappNumber,
                                    onSuccess = {
                                        isSubmitting = false
                                        showSuccessSnackbar = true
                                        actionError = null
                                    },
                                    onError = {
                                        isSubmitting = false
                                        actionError = it
                                    }
                                )
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = CatatinColors.Primary),
                            enabled = !isSubmitting && name.isNotBlank() && whatsappNumber.isNotBlank()
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                            } else {
                                Icon(Icons.Default.Save, null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Simpan Profil", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
