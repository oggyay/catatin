package com.example.catatin.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import com.example.catatin.util.FormatUtils

// ==================== TOP BAR ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CatatinTopBar(
    title: String,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {}
) {
    TopAppBar(
        title = {
            Text(
                title,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Kembali")
                }
            }
        },
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = CatatinColors.Surface
        )
    )
}

// ==================== KPI CARD ====================
@Composable
fun KpiCard(
    label: String,
    value: String,
    icon: ImageVector,
    iconTint: Color = CatatinColors.Primary,
    iconBgColor: Color = CatatinColors.PrimaryLight,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
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
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(iconBgColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = label, tint = iconTint, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    label.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = CatatinColors.TextMuted,
                    letterSpacing = 0.8.sp
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    value,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ==================== MONEY INPUT FIELD ====================
@Composable
fun MoneyInputField(
    value: Long,
    onValueChange: (Long) -> Unit,
    modifier: Modifier = Modifier,
    label: String = "Jumlah",
    isLarge: Boolean = false
) {
    val displayText = if (value == 0L) "" else FormatUtils.formatNumber(value.toDouble())
    
    OutlinedTextField(
        value = displayText,
        onValueChange = { newText ->
            val parsed = FormatUtils.parseInputNumber(newText)
            onValueChange(parsed)
        },
        modifier = modifier.fillMaxWidth(),
        label = { Text(label) },
        prefix = {
            Text(
                "Rp ",
                fontWeight = FontWeight.Bold,
                color = CatatinColors.Primary
            )
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        textStyle = if (isLarge) {
            MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
        } else {
            MaterialTheme.typography.bodyLarge
        }
    )
}

// ==================== BADGE CHIP ====================
@Composable
fun BadgeChip(
    text: String,
    color: Color,
    bgColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = bgColor
    ) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            color = color,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun StatusBadge(status: String) {
    when (status.lowercase()) {
        "active" -> BadgeChip("Aktif", CatatinColors.Success, CatatinColors.SuccessLight)
        "inactive" -> BadgeChip("Nonaktif", CatatinColors.TextMuted, CatatinColors.SurfaceVariant)
        "void" -> BadgeChip("Void", CatatinColors.Danger, CatatinColors.DangerLight)
        else -> BadgeChip(status, CatatinColors.TextSecondary, CatatinColors.SurfaceVariant)
    }
}

@Composable
fun TypeBadge(type: String) {
    when (type.lowercase()) {
        "income" -> BadgeChip("Pemasukan", CatatinColors.Success, CatatinColors.SuccessLight)
        "expense" -> BadgeChip("Pengeluaran", CatatinColors.Danger, CatatinColors.DangerLight)
        "adjustment" -> BadgeChip("Penyesuaian", CatatinColors.Warning, CatatinColors.WarningLight)
        else -> BadgeChip(type, CatatinColors.TextSecondary, CatatinColors.SurfaceVariant)
    }
}

@Composable
fun SourceBadge(source: String) {
    when (source.lowercase()) {
        "web" -> BadgeChip("Web", CatatinColors.Primary, CatatinColors.PrimaryLight)
        "whatsapp" -> BadgeChip("WhatsApp", Color(0xFF128C7E), Color(0xFFDCF8C6))
        "adjustment" -> BadgeChip("Penyesuaian", CatatinColors.Warning, CatatinColors.WarningLight)
        else -> BadgeChip(source, CatatinColors.TextSecondary, CatatinColors.SurfaceVariant)
    }
}

// ==================== TYPE TOGGLE ====================
@Composable
fun TypeToggle(
    selectedType: String,
    onTypeChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CatatinColors.SurfaceVariant)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        val isExpense = selectedType == "expense"
        
        // Expense button
        Box(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(10.dp))
                .background(if (isExpense) CatatinColors.Danger else Color.Transparent)
                .clickable { onTypeChange("expense") }
                .padding(vertical = 12.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "Pengeluaran",
                color = if (isExpense) Color.White else CatatinColors.TextSecondary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
        }
        
        // Income button
        Box(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(10.dp))
                .background(if (!isExpense) CatatinColors.Success else Color.Transparent)
                .clickable { onTypeChange("income") }
                .padding(vertical = 12.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "Pemasukan",
                color = if (!isExpense) Color.White else CatatinColors.TextSecondary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
        }
    }
}

// ==================== PERIOD SELECTOR ====================
@Composable
fun PeriodSelector(
    selectedPeriod: String,
    onPeriodChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val periods = listOf(
        "today" to "Hari ini",
        "this_week" to "Minggu ini",
        "this_month" to "Bulan ini"
    )
    
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(CatatinColors.SurfaceVariant)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        periods.forEach { (key, label) ->
            val isSelected = selectedPeriod == key
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (isSelected) CatatinColors.Primary else Color.Transparent)
                    .clickable { onPeriodChange(key) }
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    label,
                    color = if (isSelected) Color.White else CatatinColors.TextSecondary,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                )
            }
        }
    }
}

// ==================== TRANSACTION ITEM ====================
@Composable
fun TransactionItem(
    type: String,
    amount: Double,
    description: String?,
    categoryName: String?,
    accountName: String?,
    date: String,
    source: String = "web",
    status: String = "active",
    transferInfo: String? = null,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val icon = when {
        transferInfo != null -> Icons.Default.SwapHoriz
        type == "income" -> Icons.AutoMirrored.Filled.TrendingUp
        type == "expense" -> Icons.AutoMirrored.Filled.TrendingDown
        else -> Icons.Default.Tune
    }
    val iconColor = when {
        status == "void" -> CatatinColors.TextMuted
        transferInfo != null -> CatatinColors.Primary
        type == "income" -> CatatinColors.Success
        type == "expense" -> CatatinColors.Danger
        else -> CatatinColors.Warning
    }
    val iconBg = when {
        status == "void" -> CatatinColors.SurfaceVariant
        transferInfo != null -> CatatinColors.PrimaryLight
        type == "income" -> CatatinColors.SuccessLight
        type == "expense" -> CatatinColors.DangerLight
        else -> CatatinColors.WarningLight
    }
    val amountColor = when {
        status == "void" -> CatatinColors.TextMuted
        type == "income" -> CatatinColors.Success
        type == "expense" -> CatatinColors.Danger
        else -> CatatinColors.Warning
    }
    val amountPrefix = when {
        transferInfo != null -> ""
        type == "income" -> "+"
        type == "expense" -> "-"
        else -> "±"
    }
    
    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (status == "void") CatatinColors.SurfaceVariant.copy(alpha = 0.5f) else CatatinColors.Surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(iconBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = type, tint = iconColor, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    transferInfo ?: description ?: categoryName ?: "-",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(2.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (accountName != null) {
                        Text(
                            accountName,
                            style = MaterialTheme.typography.labelSmall,
                            color = CatatinColors.TextMuted
                        )
                    }
                    Text(
                        FormatUtils.formatDate(date),
                        style = MaterialTheme.typography.labelSmall,
                        color = CatatinColors.TextMuted
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "$amountPrefix${FormatUtils.formatIDR(amount)}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = amountColor
                )
                if (status == "void") {
                    Spacer(Modifier.height(2.dp))
                    StatusBadge(status)
                }
            }
        }
    }
}

// ==================== ACCOUNT CARD ====================
@Composable
fun AccountCard(
    name: String,
    type: String,
    balance: Double,
    isDefault: Boolean,
    status: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val typeIcon = when (type.lowercase()) {
        "cash" -> Icons.Default.AccountBalanceWallet
        "bank" -> Icons.Default.AccountBalance
        "ewallet" -> Icons.Default.PhoneAndroid
        else -> Icons.Default.AccountBalanceWallet
    }
    val typeLabel = when (type.lowercase()) {
        "cash" -> "Tunai"
        "bank" -> "Bank"
        "ewallet" -> "E-Wallet"
        else -> type
    }
    
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        onClick = onClick
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(CatatinColors.PrimaryLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(typeIcon, contentDescription = typeLabel, tint = CatatinColors.Primary, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    Text(typeLabel, style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
                }
                Column(horizontalAlignment = Alignment.End) {
                    if (isDefault) BadgeChip("Default", CatatinColors.Primary, CatatinColors.PrimaryLight)
                    Spacer(Modifier.height(2.dp))
                    StatusBadge(status)
                }
            }
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = CatatinColors.Border)
            Spacer(Modifier.height(12.dp))
            Text("Saldo", style = MaterialTheme.typography.labelSmall, color = CatatinColors.TextMuted)
            Text(
                FormatUtils.formatIDR(balance),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = if (balance >= 0) CatatinColors.TextPrimary else CatatinColors.Danger
            )
        }
    }
}

// ==================== CONFIRM DIALOG ====================
@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmText: String = "Ya",
    dismissText: String = "Batal",
    isDestructive: Boolean = false,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = { Text(message) },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = if (isDestructive) {
                    ButtonDefaults.buttonColors(containerColor = CatatinColors.Danger)
                } else {
                    ButtonDefaults.buttonColors()
                }
            ) {
                Text(confirmText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(dismissText)
            }
        }
    )
}

// ==================== LOADING / EMPTY / ERROR STATES ====================
@Composable
fun LoadingState(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(color = CatatinColors.Primary)
    }
}

@Composable
fun EmptyState(
    icon: ImageVector = Icons.Default.Inbox,
    title: String = "Belum ada data",
    subtitle: String = "",
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = CatatinColors.TextMuted.copy(alpha = 0.5f)
        )
        Spacer(Modifier.height(16.dp))
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            color = CatatinColors.TextSecondary
        )
        if (subtitle.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = CatatinColors.TextMuted,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun ErrorState(
    message: String = "Terjadi kesalahan",
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = CatatinColors.Danger.copy(alpha = 0.6f)
        )
        Spacer(Modifier.height(16.dp))
        Text(
            message,
            style = MaterialTheme.typography.titleMedium,
            color = CatatinColors.TextSecondary,
            textAlign = TextAlign.Center
        )
        if (onRetry != null) {
            Spacer(Modifier.height(16.dp))
            Button(onClick = onRetry) {
                Text("Coba Lagi")
            }
        }
    }
}
