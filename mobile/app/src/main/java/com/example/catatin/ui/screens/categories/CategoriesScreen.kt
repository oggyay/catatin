package com.example.catatin.ui.screens.categories

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.data.model.CategoryDto
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoriesScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: CategoriesViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTab by remember { mutableStateOf(0) } // 0 = Expense, 1 = Income

    var showCreateDialog by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    var selectedCategory by remember { mutableStateOf<CategoryDto?>(null) }

    // Form fields
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("expense") }
    var status by remember { mutableStateOf("active") }

    var actionError by remember { mutableStateOf<String?>(null) }

    val tabTitles = listOf("Pengeluaran", "Pemasukan")

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "Kelola Kategori",
                onBack = onBack
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    name = ""
                    type = if (selectedTab == 0) "expense" else "income"
                    actionError = null
                    showCreateDialog = true
                },
                containerColor = CatatinColors.Primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Tambah Kategori")
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
            // Elegant Tab Rows
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = CatatinColors.Surface,
                contentColor = CatatinColors.Primary,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                        color = CatatinColors.Primary
                    )
                }
            ) {
                tabTitles.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            Text(
                                title,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 14.sp
                            )
                        }
                    )
                }
            }

            Box(modifier = Modifier.fillMaxSize()) {
                when (val state = uiState) {
                    is CategoriesUiState.Loading -> LoadingState()
                    is CategoriesUiState.Error -> ErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadCategories() }
                    )
                    is CategoriesUiState.Success -> {
                        val filteredCategories = state.categories.filter { cat ->
                            if (selectedTab == 0) cat.type.lowercase() == "expense"
                            else cat.type.lowercase() == "income"
                        }

                        if (filteredCategories.isEmpty()) {
                            EmptyState(
                                title = "Belum ada kategori",
                                subtitle = "Tambahkan kategori ${if (selectedTab == 0) "Pengeluaran" else "Pemasukan"} untuk merinci ke mana uang Anda mengalir."
                            )
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                items(filteredCategories) { category ->
                                    Card(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                selectedCategory = category
                                                name = category.name
                                                status = category.status
                                                actionError = null
                                                showEditDialog = true
                                            },
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(16.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    category.name,
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontSize = 15.sp,
                                                    color = CatatinColors.TextPrimary
                                                )
                                                if (category.isDefault) {
                                                    Spacer(modifier = Modifier.height(2.dp))
                                                    Text(
                                                        "Kategori Bawaan",
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = CatatinColors.TextMuted
                                                    )
                                                }
                                            }
                                            StatusBadge(category.status)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Create Category Dialog
        if (showCreateDialog) {
            AlertDialog(
                onDismissRequest = { showCreateDialog = false },
                title = { Text("Kategori Baru", fontWeight = FontWeight.Bold) },
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
                            label = { Text("Nama Kategori") },
                            placeholder = { Text("Contoh: Makanan, Gaji, Transportasi") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("Tipe Kategori", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = type == "expense",
                                onClick = { type = "expense" },
                                label = { Text("Pengeluaran") }
                            )
                            FilterChip(
                                selected = type == "income",
                                onClick = { type = "income" },
                                label = { Text("Pemasukan") }
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                viewModel.createCategory(
                                    name = name,
                                    type = type,
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

        // Edit Category Dialog
        if (showEditDialog && selectedCategory != null) {
            val category = selectedCategory!!
            AlertDialog(
                onDismissRequest = { showEditDialog = false },
                title = { Text("Ubah Kategori", fontWeight = FontWeight.Bold) },
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
                            label = { Text("Nama Kategori") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !category.isDefault // default categories usually shouldn't rename
                        )

                        Text("Status Kategori", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
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

                        if (!category.isDefault) {
                            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                            Button(
                                onClick = {
                                    showEditDialog = false
                                    showDeleteConfirm = true
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = CatatinColors.Danger),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Hapus Kategori")
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                viewModel.updateCategory(
                                    id = category.id,
                                    name = name,
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

        // Delete Confirm Dialog
        if (showDeleteConfirm && selectedCategory != null) {
            val category = selectedCategory!!
            ConfirmDialog(
                title = "Hapus Kategori",
                message = "Apakah Anda yakin ingin menghapus kategori '${category.name}'? Riwayat transaksi lama dengan kategori ini akan dipindahkan ke kategori default.",
                confirmText = "Hapus",
                dismissText = "Batal",
                isDestructive = true,
                onConfirm = {
                    viewModel.deleteCategory(
                        id = category.id,
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
