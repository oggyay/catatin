package com.example.catatin.ui.screens.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.data.model.UserSettingsDto
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.*
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsUsersScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SettingsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var showCreateDialog by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    var selectedMember by remember { mutableStateOf<UserSettingsDto?>(null) }

    // Forms
    var name by remember { mutableStateOf("") }
    var waPhone by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("member") }
    var status by remember { mutableStateOf("active") }

    var actionError by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            CatatinTopBar(
                title = "Kelola Anggota Bisnis",
                onBack = onBack
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    name = ""
                    waPhone = ""
                    role = "member"
                    actionError = null
                    showCreateDialog = true
                },
                containerColor = CatatinColors.Primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Tambah Anggota")
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
                is SettingsUiState.Loading -> LoadingState()
                is SettingsUiState.Error -> ErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadSettingsData() }
                )
                is SettingsUiState.Success -> {
                    val members = state.members
                    if (members.isEmpty()) {
                        EmptyState(
                            title = "Belum ada anggota",
                            subtitle = "Tambahkan karyawan atau kasir Anda ke akun UMKM ini untuk berkolaborasi mencatat keuangan."
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(members) { member ->
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            if (member.role != "owner") { // usually owners cannot be edited/deleted by members
                                                selectedMember = member
                                                role = member.role
                                                status = member.status
                                                actionError = null
                                                showEditDialog = true
                                            }
                                        },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = CatatinColors.Surface),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(16.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(member.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = CatatinColors.TextPrimary)
                                            Text("+" + member.whatsappNumber, style = MaterialTheme.typography.bodySmall, color = CatatinColors.TextSecondary)
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                val roleLabel = when (member.role.lowercase()) {
                                                    "owner" -> "Owner (Pemilik)"
                                                    "member" -> "Kasir / Anggota"
                                                    "viewer" -> "Viewer (Lihat Saja)"
                                                    else -> member.role
                                                }
                                                BadgeChip(roleLabel, CatatinColors.Primary, CatatinColors.PrimaryLight)
                                                StatusBadge(member.status)
                                            }
                                        }
                                        if (member.role != "owner") {
                                            Icon(
                                                imageVector = Icons.Default.Edit,
                                                contentDescription = "Edit",
                                                tint = CatatinColors.TextMuted,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Create Member Dialog
        if (showCreateDialog) {
            AlertDialog(
                onDismissRequest = { showCreateDialog = false },
                title = { Text("Tambah Anggota Baru", fontWeight = FontWeight.Bold) },
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
                            label = { Text("Nama Anggota") },
                            placeholder = { Text("Contoh: Budi Prasetyo") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = waPhone,
                            onValueChange = { waPhone = it },
                            label = { Text("Nomor WhatsApp") },
                            placeholder = { Text("Contoh: 08123456789") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("Hak Akses (Role)", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = role == "member",
                                onClick = { role = "member" },
                                label = { Text("Kasir / Anggota") }
                            )
                            FilterChip(
                                selected = role == "viewer",
                                onClick = { role = "viewer" },
                                label = { Text("Lihat Saja") }
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (name.isNotBlank() && waPhone.isNotBlank()) {
                                viewModel.createMember(
                                    name = name,
                                    waPhone = waPhone,
                                    role = role,
                                    onSuccess = { showCreateDialog = false },
                                    onError = { actionError = it }
                                )
                            }
                        },
                        enabled = name.isNotBlank() && waPhone.isNotBlank()
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

        // Edit Member Dialog
        if (showEditDialog && selectedMember != null) {
            val member = selectedMember!!
            AlertDialog(
                onDismissRequest = { showEditDialog = false },
                title = { Text("Kelola Akses Anggota", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        actionError?.let {
                            Text(it, color = CatatinColors.Danger, style = MaterialTheme.typography.bodySmall)
                        }

                        Text("Nama: ${member.name}", fontWeight = FontWeight.SemiBold)
                        Text("WhatsApp: +${member.whatsappNumber}", style = MaterialTheme.typography.bodyMedium, color = CatatinColors.TextSecondary)

                        Text("Hak Akses (Role)", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = role == "member",
                                onClick = { role = "member" },
                                label = { Text("Kasir") }
                            )
                            FilterChip(
                                selected = role == "viewer",
                                onClick = { role = "viewer" },
                                label = { Text("Lihat Saja") }
                            )
                        }

                        Text("Status Anggota", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
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

                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                        Button(
                            onClick = {
                                showEditDialog = false
                                showDeleteConfirm = true
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = CatatinColors.Danger),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Hapus Anggota")
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            viewModel.updateMember(
                                id = member.id,
                                role = role,
                                status = status,
                                onSuccess = { showEditDialog = false },
                                onError = { actionError = it }
                            )
                        }
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
        if (showDeleteConfirm && selectedMember != null) {
            val member = selectedMember!!
            ConfirmDialog(
                title = "Hapus Akses Anggota",
                message = "Apakah Anda yakin ingin menghapus akses untuk '${member.name}'? Anggota ini tidak akan bisa membuka pembukuan bisnis Anda lagi.",
                confirmText = "Hapus",
                dismissText = "Batal",
                isDestructive = true,
                onConfirm = {
                    viewModel.deleteMember(
                        id = member.id,
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
