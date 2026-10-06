package com.example.catatin.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import com.example.catatin.ui.screens.auth.AuthState
import com.example.catatin.ui.screens.auth.AuthViewModel
import com.example.catatin.util.FormatUtils
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToNewTransaction: (String) -> Unit,
    onNavigateToTransactions: () -> Unit,
    onNavigateToAccounts: () -> Unit,
    onNavigateToCategories: () -> Unit,
    onNavigateToReports: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: DashboardViewModel = koinViewModel(),
    authViewModel: AuthViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val authState by authViewModel.authState.collectAsState()
    var showTenantDialog by remember { mutableStateOf(false) }
    var showCreateTenantDialog by remember { mutableStateOf(false) }
    var newTenantName by remember { mutableStateOf("") }
    var newTenantType by remember { mutableStateOf("personal") }
    var actionError by remember { mutableStateOf<String?>(null) }

    val user = (authState as? AuthState.Authenticated)?.user
    val tenants = (authState as? AuthState.Authenticated)?.tenants ?: emptyList()
    val activeTenantName = user?.tenant?.name ?: "Personal"

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { showTenantDialog = true }
                    ) {
                        Column {
                            Text(
                                text = "CatatIN",
                                style = MaterialTheme.typography.titleMedium,
                                color = CatatinColors.TextMuted,
                                fontSize = 12.sp
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = activeTenantName,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                    color = CatatinColors.TextPrimary
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(
                                    imageVector = Icons.Default.ArrowDropDown,
                                    contentDescription = "Ganti Bisnis",
                                    tint = CatatinColors.Primary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadDashboardData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Segarkan")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CatatinColors.Surface
                )
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
                is DashboardUiState.Loading -> LoadingState()
                is DashboardUiState.Error -> ErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadDashboardData() }
                )
                is DashboardUiState.Success -> {
                    val summary = state.summary
                    val transactions = state.recentTransactions

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Greeting
                        item {
                            Text(
                                text = "Halo, ${user?.name ?: "Pengguna"}!",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold,
                                color = CatatinColors.TextPrimary
                            )
                            Text(
                                text = "Berikut ringkasan pencatatan keuangan Anda hari ini.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = CatatinColors.TextSecondary
                            )
                        }

                        // Balanced Card
                        item {
                            KpiCard(
                                label = "Saldo Total",
                                value = FormatUtils.formatIDR(summary.totalBalance),
                                icon = Icons.Default.AccountBalanceWallet,
                                iconTint = CatatinColors.Primary,
                                iconBgColor = CatatinColors.PrimaryLight,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        // Income / Expense Row
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                KpiCard(
                                    label = "Pemasukan",
                                    value = FormatUtils.formatIDR(summary.monthIncome),
                                    icon = Icons.Default.TrendingUp,
                                    iconTint = CatatinColors.Success,
                                    iconBgColor = CatatinColors.SuccessLight,
                                    modifier = Modifier.weight(1f)
                                )
                                KpiCard(
                                    label = "Pengeluaran",
                                    value = FormatUtils.formatIDR(summary.monthExpense),
                                    icon = Icons.Default.TrendingDown,
                                    iconTint = CatatinColors.Danger,
                                    iconBgColor = CatatinColors.DangerLight,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }

                        // Net Cashflow
                        item {
                            val netColor = if (summary.netCashflow >= 0) CatatinColors.Success else CatatinColors.Danger
                            val netBgColor = if (summary.netCashflow >= 0) CatatinColors.SuccessLight else CatatinColors.DangerLight
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
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(netBgColor),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = if (summary.netCashflow >= 0) Icons.Default.AddCard else Icons.Default.CreditCardOff,
                                            contentDescription = "Net",
                                            tint = netColor,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = "ARUS KAS BERSIH",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = CatatinColors.TextMuted
                                        )
                                        Text(
                                            text = FormatUtils.formatIDR(summary.netCashflow),
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = netColor
                                        )
                                    }
                                }
                            }
                        }

                        // Quick Actions
                        item {
                            Text(
                                text = "Akses Cepat",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = CatatinColors.TextPrimary
                            )
                        }

                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                QuickActionButton(
                                    label = "Catat",
                                    icon = Icons.Default.Add,
                                    bgColor = CatatinColors.PrimaryLight,
                                    iconColor = CatatinColors.Primary,
                                    onClick = { onNavigateToNewTransaction("expense") }
                                )
                                QuickActionButton(
                                    label = "Dompet",
                                    icon = Icons.Default.AccountBalanceWallet,
                                    bgColor = CatatinColors.SuccessLight,
                                    iconColor = CatatinColors.Success,
                                    onClick = onNavigateToAccounts
                                )
                                QuickActionButton(
                                    label = "Kategori",
                                    icon = Icons.Default.Category,
                                    bgColor = CatatinColors.WarningLight,
                                    iconColor = CatatinColors.Warning,
                                    onClick = onNavigateToCategories
                                )
                                QuickActionButton(
                                    label = "Laporan",
                                    icon = Icons.Default.BarChart,
                                    bgColor = CatatinColors.DangerLight,
                                    iconColor = CatatinColors.Danger,
                                    onClick = onNavigateToReports
                                )
                            }
                        }

                        // Recent Transactions
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Transaksi Terakhir",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = CatatinColors.TextPrimary
                                )
                                Text(
                                    text = "Lihat Semua",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = CatatinColors.Primary,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.clickable { onNavigateToTransactions() }
                                )
                            }
                        }

                        if (transactions.isEmpty()) {
                            item {
                                EmptyState(
                                    icon = Icons.Default.ReceiptLong,
                                    title = "Belum ada transaksi",
                                    subtitle = "Catat pengeluaran dan pemasukan Anda sekarang untuk melacak keuangan."
                                )
                            }
                        } else {
                            items(transactions) { tx ->
                                TransactionItem(
                                    type = tx.type,
                                    amount = tx.amount,
                                    description = tx.description,
                                    categoryName = tx.category?.name,
                                    accountName = tx.account?.name,
                                    date = tx.transactionDate,
                                    source = tx.source,
                                    status = tx.status,
                                    transferInfo = if (tx.transferGroupId != null) {
                                        if (tx.transferDirection == "out") "Transfer ke ${tx.description ?: "-"}"
                                        else "Transfer dari ${tx.description ?: "-"}"
                                    } else null
                                )
                            }
                        }
                    }
                }
            }
        }

        // Tenant Switcher Bottom/Dialog Sheet
        if (showTenantDialog) {
            AlertDialog(
                onDismissRequest = { showTenantDialog = false },
                title = { Text("Ganti Profil Bisnis", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        actionError?.let {
                            Text(it, color = CatatinColors.Danger, style = MaterialTheme.typography.bodySmall)
                        }

                        tenants.forEach { tenantItem ->
                            val isSelected = tenantItem.tenantId == user?.tenantId
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        authViewModel.switchTenant(
                                            tenantId = tenantItem.tenantId,
                                            onSuccess = {
                                                showTenantDialog = false
                                                viewModel.loadDashboardData()
                                            },
                                            onError = { actionError = it }
                                        )
                                    },
                                colors = CardDefaults.cardColors(
                                    containerColor = if (isSelected) CatatinColors.PrimaryLight else CatatinColors.SurfaceVariant
                                ),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = if (tenantItem.tenantType == "personal") Icons.Default.Person else Icons.Default.Business,
                                        contentDescription = null,
                                        tint = if (isSelected) CatatinColors.Primary else CatatinColors.TextSecondary
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        text = tenantItem.tenantName,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) CatatinColors.Primary else CatatinColors.TextPrimary,
                                        modifier = Modifier.weight(1f)
                                    )
                                    if (isSelected) {
                                        Icon(
                                            imageVector = Icons.Default.Check,
                                            contentDescription = "Terpilih",
                                            tint = CatatinColors.Primary
                                        )
                                    }
                                }
                            }
                        }

                        Button(
                            onClick = {
                                showTenantDialog = false
                                showCreateTenantDialog = true
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = CatatinColors.Primary)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Tambah Profil Bisnis")
                        }
                    }
                },
                confirmButton = {},
                dismissButton = {
                    TextButton(onClick = { showTenantDialog = false }) {
                        Text("Tutup")
                    }
                }
            )
        }

        // Create Tenant Dialog
        if (showCreateTenantDialog) {
            AlertDialog(
                onDismissRequest = { showCreateTenantDialog = false },
                title = { Text("Buat Profil Bisnis Baru", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = newTenantName,
                            onValueChange = { newTenantName = it },
                            label = { Text("Nama Bisnis / Toko") },
                            placeholder = { Text("Contoh: Warung Berkah") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("Tipe Bisnis", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = newTenantType == "personal",
                                onClick = { newTenantType = "personal" },
                                label = { Text("Pribadi") }
                            )
                            FilterChip(
                                selected = newTenantType == "umkm",
                                onClick = { newTenantType = "umkm" },
                                label = { Text("UMKM / Toko") }
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newTenantName.isNotBlank()) {
                                authViewModel.createTenant(
                                    name = newTenantName,
                                    type = newTenantType,
                                    onSuccess = {
                                        showCreateTenantDialog = false
                                        newTenantName = ""
                                        viewModel.loadDashboardData()
                                    },
                                    onError = { actionError = it }
                                )
                            }
                        },
                        enabled = newTenantName.isNotBlank()
                    ) {
                        Text("Buat")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateTenantDialog = false }) {
                        Text("Batal")
                    }
                }
            )
        }
    }
}

@Composable
fun QuickActionButton(
    label: String,
    icon: ImageVector,
    bgColor: Color,
    iconColor: Color,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clickable { onClick() }
            .padding(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(bgColor),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = iconColor,
                modifier = Modifier.size(24.dp)
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = CatatinColors.TextSecondary
        )
    }
}
