import React from "react";
import { useAuth } from "../hooks/useAuth"; // Ton hook existant
import { useNavigate } from "react-router-dom"; // ou Next.js router si besoin
import AdminCreateUserForm from "../components/AdminCreateUserForm";

export const CreateUserPage: React.FC = () => {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return <p>Vous devez être connecté pour accéder à cette page.</p>;
  }

  if (!isAdmin) {
    return <p>Accès réservé aux administrateurs.</p>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Créer un nouvel utilisateur</h1>
      <AdminCreateUserForm />
    </div>
  );
};
