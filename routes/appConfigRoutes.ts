import {Router} from "express";
import {
    createAppConfig,
    deleteAppConfig,
    getAllAppConfigs,
    getAppConfig,
    updateAppConfig,
} from "../controllers/appConfigController";
import {authenticate} from "../middleware/authMiddleware";
import {requireRole} from "../middleware/rbacMiddleware";

const router = Router();

router.get("/", getAppConfig);
router.get("/all", authenticate, requireRole("admin"), getAllAppConfigs);
router.post("/", authenticate, requireRole("admin"), createAppConfig);
router.put("/:id", authenticate, requireRole("admin"), updateAppConfig);
router.delete("/:id", authenticate, requireRole("admin"), deleteAppConfig);

export default router;

