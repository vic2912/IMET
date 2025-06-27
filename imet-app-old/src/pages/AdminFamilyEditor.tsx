// src/pages/AdminFamilyEditor.tsx

import React, { useState } from 'react';
import { Typography, Box, List, ListItem, ListItemText, IconButton, Button, Dialog } from '@mui/material';
import { Edit, Group } from '@mui/icons-material';
import { useUsers } from '../hooks/useUsers';
import { FamilyRelationsDialog } from '../components/FamilyRelationsDialog';

export const AdminFamilyEditor: React.FC = () => {
  const { users } = useUsers();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = (id: string, name: string) => {
    setSelectedUserId(id);
    setSelectedUserName(name);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUserId(null);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Gestion des liens familiaux
      </Typography>
      <Typography variant="body2" gutterBottom>
        Cliquez sur un utilisateur pour modifier ses relations familiales.
      </Typography>
      <List>
        {users.map((user) => (
          <ListItem key={user.id} divider secondaryAction={
            <IconButton edge="end" onClick={() => handleOpenDialog(user.id, user.full_name)}>
              <Edit />
            </IconButton>
          }>
            <ListItemText
              primary={user.full_name}
              secondary={user.email}
            />
          </ListItem>
        ))}
      </List>

      {selectedUserId && (
        <FamilyRelationsDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          userId={selectedUserId}
          userName={selectedUserName}
        />
      )}
    </Box>
  );
};
