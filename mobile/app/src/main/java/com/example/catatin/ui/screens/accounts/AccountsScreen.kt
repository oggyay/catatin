package com.example.catatin.ui.screens.accounts

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.data.model.AccountDto
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import com.example.catatin.util.FormatUtils
import org.koin.compose.viewmodel.koinViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AccountsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var showCreateDialog by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var showAdjustDialog by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    var selectedAccount by remember { mutableStateOf<AccountDto?>(null) }

    // Form fields
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("cash") }
    var openingBalance by remember { mutableStateOf(0L) }
    var isDefault by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("active") }

    // Adjustment fields
    var realBalance by remember { mutableStateOf(0L) }
    var reason by remember { mutableStateOf("") }

    var actionError by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "Daftar Rekening",
                onBack = onBack
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    name = ""
                    type = "cash"
                    openingBalance = 0L
                    isDefault = false
                    actionError = null
                    showCreateDialog = true
                },
                containerColor = CatatinColors.Primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Tambah Rekening")
            }
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
                is AccountsUiState.Loading -> LoadingState()
                is AccountsUiState.Error -> ErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadAccounts() }
                )
                is AccountsUiState.Success -> {
                    val accounts = state.accounts
                    if (accounts.isEmpty()) {
                        EmptyState(
                            title = "Belum ada rekening",
                            subtitle = "Buat rekening baru seperti Dompet, Bank BCA, atau e-Wallet untuk melacak saldo Anda."
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(accounts) { account ->
                                AccountCard(
                                    name = account.name,
                                    type = account.type,
                                    balance = account.currentBalance,
                                    isDefault = account.isDefault,
                                    status = account.status,
                                    onClick = {
                                        selectedAccount = account
                                        name = account.name
                                        type = account.type
                                        isDefault = account.isDefault
                                        status = account.status
                                        actionError = null
                                        showEditDialog = true
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // Create Account Dialog
        if (showCreateDialog) {
            AlertDialog(
                onDismissRequest = { showCreateDialog = false },
                title = { Text("Rekening Baru", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        actionError?.let {
                            Text(it, color = CatatinColors.Danger, style = MaterialTheme.typography.bodySmall)
                        }

                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Nama Rekening") },
                            placeholder = { Text("Contoh: Dompet Utama, Bank Mandiri") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("Tipe Rekening", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = type == "cash",
                                onClick = { type = "cash" },
                                label = { Text("Tunai") }
                            )
                            FilterChip(
                                selected = type == "bank",
                                onClick = { type = "bank" },
                                label = { Text("Bank") }
                            )
                            FilterChip(
                                selected = type == "ewallet",
                                onClick = { type = "ewallet" },
                                label = { Text("E-Wallet") }
                            )
                        }

                        MoneyInputField(
                            value = openingBalance,
                            onValueChange = { openingBalance = it },
                            label = "Saldo Awal"
                        )

                        Row(
                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = isDefault,
                                onCheckedChange = { isDefault = it }
                            )
                            Text("Jadikan rekening utama (default)", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                viewModel.createAccount(
                                    name = name,
                                    type = type,
                                    openingBalance = openingBalance.toDouble(),
                                    isDefault = isDefault,
                                    onSuccess = { showCreateDialog = false },
                                    onError = { actionError = it }
                                )
                            }
                        },
                        enabled = name.isNotBlank()
                    ) {
                        Text("Simpan")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateDialog = false }) {
                        Text("Batal")
                    }
                }
            )
        }

        // Edit Account Dialog
        if (showEditDialog && selectedAccount != null) {
            val account = selectedAccount!!
            AlertDialog(
                onDismissRequest = { showEditDialog = false },
                title = { Text("Kelola Rekening", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        actionError?.let {
                            Text(it, color = CatatinColors.Danger, style = MaterialTheme.typography.bodySmall)
                        }

                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Nama Rekening") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("Tipe Rekening", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = type == "cash",
                                onClick = { type = "cash" },
                                label = { Text("Tunai") }
                            )
                            FilterChip(
                                selected = type == "bank",
                                onClick = { type = "bank" },
                                label = { Text("Bank") }
                            )
                            FilterChip(
                                selected = type == "ewallet",
                                onClick = { type = "ewallet" },
                                label = { Text("E-Wallet") }
                            )
                        }

                        Text("Status Rekening", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = status == "active",
                                onClick = { status = "active" },
                                label = { Text("Aktif") }
                            )
                            FilterChip(
                                selected = status == "inactive",
                                onClick = { status = "inactive" },
                                label = { Text("Nonaktif") }
                            )
                        }

                        Row(
                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = isDefault,
                                onCheckedChange = { isDefault = it }
                            )
                            Text("Jadikan rekening utama (default)", style = MaterialTheme.typography.bodyMedium)
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                        // Balance adjustment & Delete buttons
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    realBalance = account.currentBalance.toLong()
                                    reason = ""
                                    showEditDialog = false
                                    showAdjustDialog = true
                                },
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Sesuaikan Saldo")
                            }

                            Button(
                                onClick = {
                                    showEditDialog = false
                                    showDeleteConfirm = true
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CatatinColors.Danger),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Hapus Rekening")
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                viewModel.updateAccount(
                                    id = account.id,
                                    name = name,
                                    type = type,
                                    isDefault = isDefault,
                                    status = status,
                                    onSuccess = { showEditDialog = false },
                                    onError = { actionError = it }
                                )
                            }
                        },
                        enabled = name.isNotBlank()
                    ) {
                        Text("Simpan")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showEditDialog = false }) {
                        Text("Batal")
                    }
                }
            )
        }

        // Balance Adjustment Dialog
        if (showAdjustDialog && selectedAccount != null) {
            val account = selectedAccount!!
            AlertDialog(
                onDismissRequest = { showAdjustDialog = false },
                title = { Text("Sesuaikan Saldo", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        actionError?.let {
                            Text(it, color = CatatinColors.Danger, style = MaterialTheme.typography.bodySmall)
                        }

                        Text(
                            text = "Menyesuaikan saldo rekening: ${account.name}\nSaldo tercatat saat ini: ${FormatUtils.formatIDR(account.currentBalance)}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = CatatinColors.TextSecondary
                        )

                        MoneyInputField(
                            value = realBalance,
                            onValueChange = { realBalance = it },
                            label = "Saldo Sebenarnya"
                        )

                        OutlinedTextField(
                            value = reason,
                            onValueChange = { reason = it },
                            label = { Text("Alasan Penyesuaian") },
                            placeholder = { Text("Contoh: Selisih perhitungan, Uang fisik hilang") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (reason.isNotBlank()) {
                                val currentDateStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                                viewModel.adjustBalance(
                                    id = account.id,
                                    realBalance = realBalance.toDouble(),
                                    reason = reason,
                                    date = currentDateStr,
                                    onSuccess = { showAdjustDialog = false },
                                    onError = { actionError = it }
                                )
                            }
                        },
                        enabled = reason.isNotBlank()
                    ) {
                        Text("Sesuaikan")
                    }
                },
                dismissButton = {
                    TextButton(onClick = {
                        showAdjustDialog = false
                        showEditDialog = true
                    }) {
                        Text("Kembali")
                    }
                }
            )
        }

        // Delete Confirm Dialog
        if (showDeleteConfirm && selectedAccount != null) {
            val account = selectedAccount!!
            ConfirmDialog(
                title = "Hapus Rekening",
                message = "Apakah Anda yakin ingin menghapus rekening '${account.name}'? Semua riwayat transaksi pada rekening ini tidak akan dihapus, namun tidak dapat diakses dari rekening ini lagi.",
                confirmText = "Hapus",
                dismissText = "Batal",
                isDestructive = true,
                onConfirm = {
                    viewModel.deleteAccount(
                        id = account.id,
                        onSuccess = { showDeleteConfirm = false },
                        onError = { actionError = it }
                    )
                },
                onDismiss = {
                    showDeleteConfirm = false
                    showEditDialog = true
                }
            )
        }
    }
}
