from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user
import models, schemas

router = APIRouter(prefix="/marketing", tags=["Marketing"])


@router.get("", response_model=List[schemas.MarketingCampaignOut])
def get_campaigns(db: Session = Depends(get_db), _=Depends(get_current_user)):
    campaigns = db.query(models.MarketingCampaign).order_by(models.MarketingCampaign.start_date.desc()).all()
    result = []
    for c in campaigns:
        out = schemas.MarketingCampaignOut.model_validate(c)
        out.roas = (c.sales_amount / c.budget) if c.budget > 0 else 0.0
        result.append(out)
    return result


@router.post("", response_model=schemas.MarketingCampaignOut)
def create_campaign(data: schemas.MarketingCampaignCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    roas = (data.sales_amount / data.budget) if data.budget > 0 else 0.0
    campaign = models.MarketingCampaign(**data.model_dump(), roas=roas)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    out = schemas.MarketingCampaignOut.model_validate(campaign)
    out.roas = roas
    return out


@router.put("/{campaign_id}", response_model=schemas.MarketingCampaignOut)
def update_campaign(campaign_id: int, data: schemas.MarketingCampaignUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    campaign = db.query(models.MarketingCampaign).filter(models.MarketingCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for key, value in data.model_dump().items():
        setattr(campaign, key, value)
    campaign.roas = (data.sales_amount / data.budget) if data.budget > 0 else 0.0
    db.commit()
    db.refresh(campaign)
    out = schemas.MarketingCampaignOut.model_validate(campaign)
    out.roas = campaign.roas
    return out


@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    campaign = db.query(models.MarketingCampaign).filter(models.MarketingCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return {"message": "Campaign deleted"}
