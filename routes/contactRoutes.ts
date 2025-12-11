import {Router} from "express";
import {
    createContact,
    deleteContact,
    getAllContacts,
    getContactById,
    updateContact,
} from "../controllers/contactController";
import {authenticate} from "../middleware/authMiddleware";
import {requireRole} from "../middleware/rbacMiddleware";

const router = Router();

router.post("/", createContact);
router.get("/", authenticate, requireRole("admin"), getAllContacts);
router.get("/:id", authenticate, requireRole("admin"), getContactById);
router.put("/:id", authenticate, requireRole("admin"), updateContact);
router.delete("/:id", authenticate, requireRole("admin"), deleteContact);

export default router;
