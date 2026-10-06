package com.example.catatin.ui.screens.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import java.util.Locale
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import com.example.catatin.util.FormatUtils
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CashflowReportScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ReportsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val selectedPeriod by viewModel.selectedPeriod.collectAsState()
    var selectedBreakdownTab by remember { mutableStateOf(0) } // 0 = Expense, 1 = Income

    val breakdownTitles = listOf("Pengeluaran", "Pemasukan")

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "Laporan Arus Kas",
                onBack = onBack
            )
        },
        containerColor = CatatinColors.Background,
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Period selector
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                PeriodSelector(
                    selectedPeriod = selectedPeriod,
                    onPeriodChange = { viewModel.updatePeriod(it) }
                )
            }

            Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                when (val state = uiState) {
                    is ReportsUiState.Loading -> LoadingState()
                    is ReportsUiState.Error -> ErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadReport() }
                    )
                    is ReportsUiState.Success -> {
                        val report = state.report
                        val netColor = if (report.netCashflow >= 0) CatatinColors.Success else CatatinColors.Danger

                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Summary Cards
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Text(
                                            "Ringkasan Arus Kas",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 16.sp,
                                            color = CatatinColors.TextPrimary
                                        )

                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Column {
                                                Text("Total Pemasukan", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                Text(FormatUtils.formatIDR(report.totalIncome), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = CatatinColors.Success)
                                            }
                                            Column(horizontalAlignment = Alignment.End) {
                                                Text("Total Pengeluaran", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                Text(FormatUtils.formatIDR(report.totalExpense), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = CatatinColors.Danger)
                                            }
                                        }

                                        HorizontalDivider(color = CatatinColors.Border)

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                "Selisih Kas Bersih",
                                                fontWeight = FontWeight.SemiBold,
                                                fontSize = 14.sp,
                                                color = CatatinColors.TextSecondary
                                            )
                                            Text(
                                                FormatUtils.formatIDR(report.netCashflow),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 18.sp,
                                                color = netColor
                                            )
                                        }
                                    }
                                }
                            }

                            // Category Breakdown Title
                            item {
                                Text(
                                    "Analisis Kategori",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = CatatinColors.TextPrimary
                                )
                            }

                            // Category breakdown switch
                            item {
                                TabRow(
                                    selectedTabIndex = selectedBreakdownTab,
                                    containerColor = CatatinColors.Surface,
                                    contentColor = CatatinColors.Primary,
                                    modifier = Modifier.clip(RoundedCornerShape(12.dp)),
                                    indicator = { tabPositions ->
                                        TabRowDefaults.SecondaryIndicator(
                                            Modifier.tabIndicatorOffset(tabPositions[selectedBreakdownTab]),
                                            color = CatatinColors.Primary
                                        )
                                    }
                                ) {
                                    breakdownTitles.forEachIndexed { idx, title ->
                                        Tab(
                                            selected = selectedBreakdownTab == idx,
                                            onClick = { selectedBreakdownTab = idx },
                                            text = { Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp) }
                                        )
                                    }
                                }
                            }

                            // Category progress items
                            val categoriesToDraw = if (selectedBreakdownTab == 0) report.expenseByCategory else report.incomeByCategory
                            val totalValue = if (selectedBreakdownTab == 0) report.totalExpense else report.totalIncome

                            if (categoriesToDraw.isEmpty()) {
                                item {
                                    EmptyState(
                                        title = "Belum ada transaksi kategori",
                                        subtitle = "Semua transaksi dengan kategori terpilih akan muncul di sini."
                                    )
                                }
                            } else {
                                items(categoriesToDraw) { breakdown ->
                                    val percentage = if (totalValue > 0) (breakdown.total / totalValue).toFloat() else 0f
                                    val barColor = if (selectedBreakdownTab == 0) CatatinColors.Danger else CatatinColors.Success
                                    val barBgColor = if (selectedBreakdownTab == 0) CatatinColors.DangerLight else CatatinColors.SuccessLight

                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                Column {
                                                    Text(breakdown.categoryName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                                    Text("${breakdown.count} kali transaksi", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                }
                                                Column(horizontalAlignment = Alignment.End) {
                                                    Text(FormatUtils.formatIDR(breakdown.total), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                                    Text(String.format(Locale.getDefault(), "%.1f%%", percentage * 100), style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextSecondary)
                                                }
                                            }
                                            // Progress bar
                                            LinearProgressIndicator(
                                                progress = { percentage },
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .height(6.dp)
                                                    .clip(CircleShape),
                                                color = barColor,
                                                trackColor = barBgColor
                                            )
                                        }
                                    }
                                }
                            }

                            // Account Cashflow Breakdown
                            item {
                                Text(
                                    "Arus Kas per Rekening",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = CatatinColors.TextPrimary
                                )
                            }

                            if (report.perAccount.isEmpty()) {
                                item {
                                    EmptyState(
                                        title = "Belum ada catatan rekening"
                                    )
                                }
                            } else {
                                items(report.perAccount) { acc ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Text(acc.accountName, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = CatatinColors.TextPrimary)
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                Column {
                                                    Text("Pemasukan", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                    Text(FormatUtils.formatIDR(acc.income), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = CatatinColors.Success)
                                                }
                                                Column {
                                                    Text("Pengeluaran", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                    Text(FormatUtils.formatIDR(acc.expense), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = CatatinColors.Danger)
                                                }
                                                Column(horizontalAlignment = Alignment.End) {
                                                    Text("Kas Bersih", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                                                    val accNetColor = if (acc.net >= 0) CatatinColors.Success else CatatinColors.Danger
                                                    Text(FormatUtils.formatIDR(acc.net), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = accNetColor)
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
        }
    }
}
