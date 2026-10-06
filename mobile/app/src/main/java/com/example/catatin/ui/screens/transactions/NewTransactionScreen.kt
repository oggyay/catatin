package com.example.catatin.ui.screens.transactions

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import com.example.catatin.util.FormatUtils
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import org.koin.compose.viewmodel.koinViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewTransactionScreen(
    initialType: String = "expense",
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: TransactionsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var activeTab by remember { mutableStateOf(if (initialType == "transfer") 2 else if (initialType == "income") 1 else 0) }

    // Forms
    var amount by remember { mutableStateOf(0L) }
    var selectedAccountId by remember { mutableStateOf("") }
    var selectedToAccountId by remember { mutableStateOf("") } // only for transfer
    var selectedCategoryId by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var dateStr by remember { mutableStateOf(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())) }

    var actionError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    // Reset fields on tab change
    LaunchedEffect(activeTab) {
        amount = 0L
        description = ""
        actionError = null
    }

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "Catat Keuangan",
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
                is TransactionsUiState.Loading -> LoadingState()
                is TransactionsUiState.Error -> ErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadInitialData() }
                )
                is TransactionsUiState.Success -> {
                    // Set default accounts/categories if not yet selected
                    if (selectedAccountId.isEmpty() && state.accounts.isNotEmpty()) {
                        selectedAccountId = state.accounts.find { it.isDefault }?.id ?: state.accounts.first().id
                    }
                    if (selectedToAccountId.isEmpty() && state.accounts.size > 1) {
                        selectedToAccountId = state.accounts.firstOrNull { it.id != selectedAccountId }?.id ?: ""
                    }
                    val expenseCategories = state.categories.filter { it.type.lowercase() == "expense" }
                    val incomeCategories = state.categories.filter { it.type.lowercase() == "income" }

                    if (selectedCategoryId.isEmpty()) {
                        if (activeTab == 0 && expenseCategories.isNotEmpty()) {
                            selectedCategoryId = expenseCategories.first().id
                        } else if (activeTab == 1 && incomeCategories.isNotEmpty()) {
                            selectedCategoryId = incomeCategories.first().id
                        }
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Custom premium switch
                        TabRow(
                            selectedTabIndex = activeTab,
                            containerColor = CatatinColors.Surface,
                            contentColor = CatatinColors.Primary,
                            indicator = { tabPositions ->
                                TabRowDefaults.SecondaryIndicator(
                                    Modifier.tabIndicatorOffset(tabPositions[activeTab]),
                                    color = CatatinColors.Primary
                                )
                            }
                        ) {
                            Tab(selected = activeTab == 0, onClick = { activeTab = 0; selectedCategoryId = expenseCategories.firstOrNull()?.id ?: "" }, text = { Text("Pengeluaran") })
                            Tab(selected = activeTab == 1, onClick = { activeTab = 1; selectedCategoryId = incomeCategories.firstOrNull()?.id ?: "" }, text = { Text("Pemasukan") })
                            Tab(selected = activeTab == 2, onClick = { activeTab = 2 }, text = { Text("Transfer Uang") })
                        }

                        actionError?.let {
                            Surface(
                                color = CatatinColors.DangerLight,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = it,
                                    color = CatatinColors.Danger,
                                    modifier = Modifier.padding(12.dp),
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        // Money Input Field
                        MoneyInputField(
                            value = amount,
                            onValueChange = { amount = it },
                            label = "Jumlah Uang",
                            isLarge = true
                        )

                        // If not Transfer, show standard Transaction Form
                        if (activeTab < 2) {
                            // Account Selector
                            var accountDropdownExpanded by remember { mutableStateOf(false) }
                            val activeAccountName = state.accounts.find { it.id == selectedAccountId }?.name ?: "Pilih Rekening"
                            Box(modifier = Modifier.fillMaxWidth()) {
                                OutlinedTextField(
                                    value = activeAccountName,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("Rekening / Dompet") },
                                    trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { accountDropdownExpanded = true },
                                    enabled = false,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        disabledTextColor = CatatinColors.TextPrimary,
                                        disabledBorderColor = CatatinColors.Border,
                                        disabledLabelColor = CatatinColors.TextSecondary
                                    )
                                )
                                DropdownMenu(
                                    expanded = accountDropdownExpanded,
                                    onDismissRequest = { accountDropdownExpanded = false },
                                    modifier = Modifier.fillMaxWidth(0.9f)
                                ) {
                                    state.accounts.forEach { acc ->
                                        DropdownMenuItem(
                                            text = { Text("${acc.name} (Saldo: ${FormatUtils.formatIDR(acc.currentBalance)})") },
                                            onClick = {
                                                selectedAccountId = acc.id
                                                accountDropdownExpanded = false
                                            }
                                        )
                                    }
                                }
                            }

                            // Category Selector
                            var categoryDropdownExpanded by remember { mutableStateOf(false) }
                            val activeCategories = if (activeTab == 0) expenseCategories else incomeCategories
                            val activeCategoryName = activeCategories.find { it.id == selectedCategoryId }?.name ?: "Pilih Kategori"

                            if (activeCategories.isNotEmpty()) {
                                Box(modifier = Modifier.fillMaxWidth()) {
                                    OutlinedTextField(
                                        value = activeCategoryName,
                                        onValueChange = {},
                                        readOnly = true,
                                        label = { Text("Kategori") },
                                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable { categoryDropdownExpanded = true },
                                        enabled = false,
                                        colors = OutlinedTextFieldDefaults.colors(
                                            disabledTextColor = CatatinColors.TextPrimary,
                                            disabledBorderColor = CatatinColors.Border,
                                            disabledLabelColor = CatatinColors.TextSecondary
                                        )
                                    )
                                    DropdownMenu(
                                        expanded = categoryDropdownExpanded,
                                        onDismissRequest = { categoryDropdownExpanded = false },
                                        modifier = Modifier.fillMaxWidth(0.9f)
                                    ) {
                                        activeCategories.forEach { cat ->
                                            DropdownMenuItem(
                                                text = { Text(cat.name) },
                                                onClick = {
                                                    selectedCategoryId = cat.id
                                                    categoryDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }
                        } else {
                            // Transfer: From Account Selector
                            var fromAccountDropdownExpanded by remember { mutableStateOf(false) }
                            val fromAccountName = state.accounts.find { it.id == selectedAccountId }?.name ?: "Pilih Rekening Asal"
                            Box(modifier = Modifier.fillMaxWidth()) {
                                OutlinedTextField(
                                    value = fromAccountName,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("Dari Rekening Asal") },
                                    trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { fromAccountDropdownExpanded = true },
                                    enabled = false,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        disabledTextColor = CatatinColors.TextPrimary,
                                        disabledBorderColor = CatatinColors.Border,
                                        disabledLabelColor = CatatinColors.TextSecondary
                                    )
                                )
                                DropdownMenu(
                                    expanded = fromAccountDropdownExpanded,
                                    onDismissRequest = { fromAccountDropdownExpanded = false },
                                    modifier = Modifier.fillMaxWidth(0.9f)
                                ) {
                                    state.accounts.forEach { acc ->
                                        DropdownMenuItem(
                                            text = { Text("${acc.name} (Saldo: ${FormatUtils.formatIDR(acc.currentBalance)})") },
                                            onClick = {
                                                selectedAccountId = acc.id
                                                fromAccountDropdownExpanded = false
                                            }
                                        )
                                    }
                                }
                            }

                            // Transfer: To Account Selector
                            var toAccountDropdownExpanded by remember { mutableStateOf(false) }
                            val toAccountName = state.accounts.find { it.id == selectedToAccountId }?.name ?: "Pilih Rekening Tujuan"
                            Box(modifier = Modifier.fillMaxWidth()) {
                                OutlinedTextField(
                                    value = toAccountName,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("Ke Rekening Tujuan") },
                                    trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { toAccountDropdownExpanded = true },
                                    enabled = false,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        disabledTextColor = CatatinColors.TextPrimary,
                                        disabledBorderColor = CatatinColors.Border,
                                        disabledLabelColor = CatatinColors.TextSecondary
                                    )
                                )
                                DropdownMenu(
                                    expanded = toAccountDropdownExpanded,
                                    onDismissRequest = { toAccountDropdownExpanded = false },
                                    modifier = Modifier.fillMaxWidth(0.9f)
                                ) {
                                    state.accounts.forEach { acc ->
                                        DropdownMenuItem(
                                            text = { Text("${acc.name} (Saldo: ${FormatUtils.formatIDR(acc.currentBalance)})") },
                                            onClick = {
                                                selectedToAccountId = acc.id
                                                toAccountDropdownExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
                        }

                        // Date field
                        OutlinedTextField(
                            value = dateStr,
                            onValueChange = { dateStr = it },
                            label = { Text("Tanggal Transaksi") },
                            placeholder = { Text("YYYY-MM-DD") },
                            trailingIcon = { Icon(Icons.Default.CalendarMonth, null, tint = CatatinColors.Primary) },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        // Notes Field
                        OutlinedTextField(
                            value = description,
                            onValueChange = { description = it },
                            label = { Text("Catatan / Keterangan") },
                            placeholder = { Text(if (activeTab == 2) "Contoh: Transfer uang belanja bulanan" else "Contoh: Beli makan siang, Bayar sewa") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2
                        )

                        Spacer(modifier = Modifier.weight(1f))

                        // Submit Button
                        Button(
                            onClick = {
                                if (amount <= 0L) {
                                    actionError = "Jumlah uang harus lebih besar dari Rp 0"
                                    return@Button
                                }
                                isSubmitting = true
                                if (activeTab < 2) {
                                    val txType = if (activeTab == 0) "expense" else "income"
                                    viewModel.createTransaction(
                                        type = txType,
                                        amount = amount.toDouble(),
                                        accountId = selectedAccountId,
                                        categoryId = selectedCategoryId.ifEmpty { null },
                                        date = dateStr,
                                        description = description.ifBlank { null },
                                        onSuccess = {
                                            isSubmitting = false
                                            onBack()
                                        },
                                        onError = {
                                            isSubmitting = false
                                            actionError = it
                                        }
                                    )
                                } else {
                                    if (selectedAccountId == selectedToAccountId) {
                                        isSubmitting = false
                                        actionError = "Rekening asal dan rekening tujuan tidak boleh sama"
                                        return@Button
                                    }
                                    viewModel.transfer(
                                        fromAccountId = selectedAccountId,
                                        toAccountId = selectedToAccountId,
                                        amount = amount.toDouble(),
                                        description = description.ifBlank { null },
                                        date = dateStr,
                                        onSuccess = {
                                            isSubmitting = false
                                            onBack()
                                        },
                                        onError = {
                                            isSubmitting = false
                                            actionError = it
                                        }
                                    )
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = CatatinColors.Primary),
                            enabled = !isSubmitting && amount > 0L
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                            } else {
                                Text(
                                    text = if (activeTab == 2) "Lakukan Transfer" else "Catat Transaksi",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
