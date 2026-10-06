package com.example.catatin.ui.screens.transactions

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.data.model.TransactionDto
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import com.example.catatin.util.FormatUtils
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsScreen(
    onBack: () -> Unit,
    onNavigateToNewTransaction: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: TransactionsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val selectedType by viewModel.selectedType.collectAsState()
    val selectedAccountId by viewModel.selectedAccountId.collectAsState()
    val selectedCategoryId by viewModel.selectedCategoryId.collectAsState()

    var showVoidConfirm by remember { mutableStateOf(false) }
    var selectedTxForVoid by remember { mutableStateOf<TransactionDto?>(null) }
    var actionError by remember { mutableStateOf<String?>(null) }

    val filterTypes = listOf(
        null to "Semua",
        "expense" to "Pengeluaran",
        "income" to "Pemasukan",
        "transfer" to "Transfer"
    )

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "Riwayat Transaksi",
                onBack = onBack
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToNewTransaction("expense") },
                containerColor = CatatinColors.Primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Catat Transaksi")
            }
        },
        containerColor = CatatinColors.Background,
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search Input
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { viewModel.updateSearchQuery(it) },
                placeholder = { Text("Cari deskripsi transaksi...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = CatatinColors.TextMuted) },
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = CatatinColors.Primary,
                    unfocusedBorderColor = CatatinColors.Border
                )
            )

            // Horizontal Filters Row (Type)
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filterTypes) { (typeKey, label) ->
                    val isSelected = selectedType == typeKey
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.updateSelectedType(typeKey) },
                        label = { Text(label) }
                    )
                }
            }

            // Sub-Filters Row (Accounts / Categories) if data loaded successfully
            if (uiState is TransactionsUiState.Success) {
                val successState = uiState as TransactionsUiState.Success
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Account Dropdown Filter
                    item {
                        var accountExpanded by remember { mutableStateOf(false) }
                        val activeAccountName = successState.accounts.find { it.id == selectedAccountId }?.name ?: "Semua Rekening"
                        Box {
                            FilterChip(
                                selected = selectedAccountId != null,
                                onClick = { accountExpanded = true },
                                label = { Text(activeAccountName) }
                            )
                            DropdownMenu(
                                expanded = accountExpanded,
                                onDismissRequest = { accountExpanded = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Semua Rekening") },
                                    onClick = {
                                        viewModel.updateSelectedAccount(null)
                                        accountExpanded = false
                                    }
                                )
                                successState.accounts.forEach { acc ->
                                    DropdownMenuItem(
                                        text = { Text(acc.name) },
                                        onClick = {
                                            viewModel.updateSelectedAccount(acc.id)
                                            accountExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // Category Dropdown Filter (Hide if Transfer type is selected)
                    if (selectedType != "transfer") {
                        item {
                            var categoryExpanded by remember { mutableStateOf(false) }
                            val activeCategoryName = successState.categories.find { it.id == selectedCategoryId }?.name ?: "Semua Kategori"
                            Box {
                                FilterChip(
                                    selected = selectedCategoryId != null,
                                    onClick = { categoryExpanded = true },
                                    label = { Text(activeCategoryName) }
                                )
                                DropdownMenu(
                                    expanded = categoryExpanded,
                                    onDismissRequest = { categoryExpanded = false }
                                ) {
                                    DropdownMenuItem(
                                        text = { Text("Semua Kategori") },
                                        onClick = {
                                            viewModel.updateSelectedCategory(null)
                                            categoryExpanded = false
                                        }
                                    )
                                    successState.categories.forEach { cat ->
                                        DropdownMenuItem(
                                            text = { Text(cat.name) },
                                            onClick = {
                                                viewModel.updateSelectedCategory(cat.id)
                                                categoryExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Results List
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                when (val state = uiState) {
                    is TransactionsUiState.Loading -> LoadingState()
                    is TransactionsUiState.Error -> ErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadInitialData() }
                    )
                    is TransactionsUiState.Success -> {
                        val transactions = state.transactions
                        if (transactions.isEmpty()) {
                            EmptyState(
                                title = "Tidak menemukan transaksi",
                                subtitle = "Coba ubah kata kunci pencarian atau matikan filter yang aktif."
                            )
                        } else {
                            Column(modifier = Modifier.fillMaxSize()) {
                                LazyColumn(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .weight(1f),
                                    contentPadding = PaddingValues(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(transactions) { tx ->
                                        val isTransfer = tx.transferGroupId != null
                                        TransactionItem(
                                            type = tx.type,
                                            amount = tx.amount,
                                            description = tx.description,
                                            categoryName = tx.category?.name,
                                            accountName = tx.account?.name,
                                            date = tx.transactionDate,
                                            source = tx.source,
                                            status = tx.status,
                                            transferInfo = if (isTransfer) {
                                                if (tx.transferDirection == "out") "Transfer ke ${tx.description ?: "-"}"
                                                else "Transfer dari ${tx.description ?: "-"}"
                                            } else null,
                                            onClick = {
                                                if (tx.status == "active") {
                                                    selectedTxForVoid = tx
                                                    actionError = null
                                                    showVoidConfirm = true
                                                }
                                            }
                                        )
                                    }
                                }

                                // Pagination Control
                                state.pagination?.let { pag ->
                                    if (pag.totalPages > 1) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(16.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            IconButton(
                                                enabled = pag.page > 1,
                                                onClick = { viewModel.loadTransactions(pag.page - 1) }
                                            ) {
                                                Icon(Icons.Default.ArrowBackIos, contentDescription = "Sebelumnya")
                                            }
                                            Text(
                                                text = "Halaman ${pag.page} dari ${pag.totalPages}",
                                                style = MaterialTheme.typography.bodyMedium,
                                                fontWeight = FontWeight.Medium
                                            )
                                            IconButton(
                                                enabled = pag.page < pag.totalPages,
                                                onClick = { viewModel.loadTransactions(pag.page + 1) }
                                            ) {
                                                Icon(Icons.Default.ArrowForwardIos, contentDescription = "Selanjutnya")
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

        // Void Confirmation Dialog
        if (showVoidConfirm && selectedTxForVoid != null) {
            val tx = selectedTxForVoid!!
            ConfirmDialog(
                title = "Batalkan Transaksi (Void)",
                message = "Apakah Anda yakin ingin membatalkan transaksi sebesar ${FormatUtils.formatIDR(tx.amount)}? Transaksi yang dibatalkan tidak akan terhitung dalam neraca saldo namun tetap tercatat sebagai arsip riwayat.",
                confirmText = "Ya, Void",
                dismissText = "Batal",
                isDestructive = true,
                onConfirm = {
                    viewModel.voidTransaction(
                        id = tx.id,
                        onSuccess = { showVoidConfirm = false },
                        onError = { actionError = it }
                    )
                },
                onDismiss = { showVoidConfirm = false }
            )
        }
    }
}
