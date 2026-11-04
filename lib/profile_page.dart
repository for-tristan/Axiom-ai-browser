import 'package:flutter/material.dart';

import 'axiom_page_shell.dart';
import 'browser_store.dart';
import 'theme.dart';

/// بروفايل محلي على الجهاز: الاسم والإيميل وإحصائيات بسيطة.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final BrowserStore _store = BrowserStore.instance;

  @override
  void initState() {
    super.initState();
    _store.init();
  }

  Future<void> _edit() async {
    final UserProfile? result = await showDialog<UserProfile>(
      context: context,
      builder: (ctx) => _EditProfileDialog(initial: _store.profile),
    );
    if (result != null) {
      await _store.updateProfile(name: result.name, email: result.email);
    }
  }

  Widget _statCard(String label, int value) {
    return Expanded(
      child: AxiomCard(
        child: Column(
          children: [
            Text(
              '$value',
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(fontSize: 13, color: AxiomColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    final UserProfile profile = _store.profile;
    final String initial =
        profile.name.trim().isEmpty ? '?' : profile.name.trim()[0].toUpperCase();

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 8),
            Center(
              child: CircleAvatar(
                radius: 42,
                backgroundColor: AxiomColors.accent,
                child: Text(
                  initial,
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w700,
                    color: AxiomColors.bgTop,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Center(
              child: Text(
                profile.name,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 4),
            Center(
              child: Text(
                profile.email.isEmpty ? 'No email added' : profile.email,
                style: TextStyle(color: AxiomColors.textMuted),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AxiomColors.accent,
                  foregroundColor: AxiomColors.bgTop,
                ),
                onPressed: _edit,
                icon: const Icon(Icons.edit, size: 16),
                label: const Text('Edit profile'),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                _statCard('Saved pages', _store.bookmarksCount),
                const SizedBox(width: 10),
                _statCard('Visited pages', _store.historyCount),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _store,
      builder: (context, _) {
        return AxiomPageShell(
          title: 'Profile',
          icon: Icons.person,
          child: _body(),
        );
      },
    );
  }
}

class _EditProfileDialog extends StatefulWidget {
  const _EditProfileDialog({required this.initial});

  final UserProfile initial;

  @override
  State<_EditProfileDialog> createState() => _EditProfileDialogState();
}

class _EditProfileDialogState extends State<_EditProfileDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initial.name);
    _emailController = TextEditingController(text: widget.initial.email);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  InputDecoration _decoration(String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: AxiomColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AxiomColors.radius),
        borderSide: BorderSide(color: AxiomColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AxiomColors.radius),
        borderSide: BorderSide(color: AxiomColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AxiomColors.radius),
        borderSide: const BorderSide(color: AxiomColors.accent),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AxiomColors.bgBottom,
      title: const Text('Edit profile'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _nameController,
            keyboardType: TextInputType.name,
            textCapitalization: TextCapitalization.words,
            cursorColor: AxiomColors.accent,
            decoration: _decoration('Name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            cursorColor: AxiomColors.accent,
            decoration: _decoration('Email'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(
            context,
            UserProfile(
              name: _nameController.text,
              email: _emailController.text,
            ),
          ),
          child: const Text(
            'Save',
            style: TextStyle(color: AxiomColors.accent),
          ),
        ),
      ],
    );
  }
}
