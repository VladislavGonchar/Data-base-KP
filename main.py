from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy import create_engine, Column, Integer, String, Numeric, Date, ForeignKey, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, joinedload
from pydantic import BaseModel
from typing import List, Optional
import os
from datetime import date
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME')}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class Manufacturer(Base):
    __tablename__ = 'manufacturers'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    gpu_models = relationship("GPUModel", back_populates="manufacturer")

class GPUModel(Base):
    __tablename__ = 'gpu_models'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    manufacturer_id = Column(Integer, ForeignKey('manufacturers.id'))
    release_year = Column(Integer)
    manufacturer = relationship("Manufacturer", back_populates="gpu_models")
    specifications = relationship("Specification", back_populates="gpu_model", cascade="all, delete-orphan")
    prices = relationship("Price", back_populates="gpu_model", cascade="all, delete-orphan")

class Specification(Base):
    __tablename__ = 'specifications'
    id = Column(Integer, primary_key=True, index=True)
    gpu_id = Column(Integer, ForeignKey('gpu_models.id'))
    memory_size = Column(Integer)
    memory_type = Column(String(20))
    bus_width = Column(Integer)
    base_clock = Column(Integer)
    max_resolution = Column(String(50))
    psu_power_requirement = Column(Integer)
    gpu_model = relationship("GPUModel", back_populates="specifications")

class Price(Base):
    __tablename__ = 'prices'
    id = Column(Integer, primary_key=True, index=True)
    gpu_id = Column(Integer, ForeignKey('gpu_models.id'))
    price = Column(Numeric(10, 2))
    date = Column(Date)
    gpu_model = relationship("GPUModel", back_populates="prices")

Base.metadata.create_all(bind=engine)

class ManufacturerCreate(BaseModel):
    name: str

class ManufacturerResponse(ManufacturerCreate):
    id: int
    class Config:
        from_attributes = True

class GPUCreate(BaseModel):
    name: str
    manufacturer_id: int
    release_year: int

class GPUResponse(GPUCreate):
    id: int
    class Config:
        from_attributes = True

class SpecificationCreate(BaseModel):
    gpu_id: int
    memory_size: Optional[int] = None
    memory_type: Optional[str] = None
    bus_width: Optional[int] = None
    base_clock: Optional[int] = None
    max_resolution: Optional[str] = None
    psu_power_requirement: Optional[int] = None

class SpecificationResponse(BaseModel):
    id: int
    gpu_id: int
    memory_size: Optional[int] = None
    memory_type: Optional[str] = None
    bus_width: Optional[int] = None
    base_clock: Optional[int] = None
    max_resolution: Optional[str] = None
    psu_power_requirement: Optional[int] = None
    class Config:
        from_attributes = True

class PriceCreate(BaseModel):
    gpu_id: int
    price: float
    date: date

class PriceResponse(PriceCreate):
    id: int
    class Config:
        from_attributes = True

class FullGPUResponse(BaseModel):
    id: int
    name: str
    manufacturer: ManufacturerResponse
    release_year: int
    specifications: List[SpecificationResponse]
    prices: List[PriceResponse]
    class Config:
        from_attributes = True

@app.get("/", response_model=dict)
async def root():
    return {"message": "GPU Database API"}

@app.get("/memory-types/")
async def get_memory_types():
    return [
        "GDDR6", "GDDR6X", "GDDR5", "GDDR5X",
        "HBM2", "HBM2E", "HBM3", "LPDDR4", "LPDDR5"
    ]

@app.get("/manufacturers/", response_model=List[ManufacturerResponse])
async def get_manufacturers(db: Session = Depends(get_db)):
    return db.query(Manufacturer).all()

@app.post("/manufacturers/", response_model=ManufacturerResponse)
async def create_manufacturer(manufacturer: ManufacturerCreate, db: Session = Depends(get_db)):
    db_manufacturer = Manufacturer(**manufacturer.dict())
    db.add(db_manufacturer)
    db.commit()
    db.refresh(db_manufacturer)
    return db_manufacturer

@app.get("/gpus/", response_model=List[FullGPUResponse])
async def get_gpus(db: Session = Depends(get_db)):
    gpus = db.query(GPUModel).options(
        joinedload(GPUModel.manufacturer),
        joinedload(GPUModel.specifications),
        joinedload(GPUModel.prices)
    ).all()
    return gpus

@app.post("/gpus/", response_model=GPUResponse)
async def create_gpu(gpu: GPUCreate, db: Session = Depends(get_db)):
    db_gpu = GPUModel(**gpu.dict())
    db.add(db_gpu)
    db.commit()
    db.refresh(db_gpu)
    return db_gpu

@app.get("/gpus/{gpu_id}", response_model=FullGPUResponse)
async def get_gpu(gpu_id: int, db: Session = Depends(get_db)):
    gpu = db.query(GPUModel).options(
        joinedload(GPUModel.manufacturer),
        joinedload(GPUModel.specifications),
        joinedload(GPUModel.prices)
    ).filter(GPUModel.id == gpu_id).first()
    if not gpu:
        raise HTTPException(status_code=404, detail="GPU not found")
    return gpu

@app.put("/gpus/{gpu_id}", response_model=GPUResponse)
async def update_gpu(gpu_id: int, gpu: GPUCreate, db: Session = Depends(get_db)):
    db_gpu = db.query(GPUModel).filter(GPUModel.id == gpu_id).first()
    if not db_gpu:
        raise HTTPException(status_code=404, detail="GPU not found")
    
    db_gpu.name = gpu.name
    db_gpu.manufacturer_id = gpu.manufacturer_id
    db_gpu.release_year = gpu.release_year
    
    db.commit()
    db.refresh(db_gpu)
    return db_gpu

@app.delete("/gpus/{gpu_id}")
async def delete_gpu(gpu_id: int, db: Session = Depends(get_db)):
    try:
        db_gpu = db.query(GPUModel).filter(GPUModel.id == gpu_id).first()
        if not db_gpu:
            raise HTTPException(status_code=404, detail="GPU not found")
        
        db.delete(db_gpu)
        db.commit()
        return {"message": "GPU deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/specifications/", response_model=SpecificationResponse)
async def create_specification(spec: SpecificationCreate, db: Session = Depends(get_db)):
    db_spec = Specification(**spec.dict())
    db.add(db_spec)
    db.commit()
    db.refresh(db_spec)
    return db_spec

@app.put("/specifications/{spec_id}", response_model=SpecificationResponse)
async def update_specification(spec_id: int, spec: SpecificationCreate, db: Session = Depends(get_db)):
    db_spec = db.query(Specification).filter(Specification.id == spec_id).first()
    if not db_spec:
        raise HTTPException(status_code=404, detail="Specification not found")
    
    for key, value in spec.dict().items():
        if value is not None:
            setattr(db_spec, key, value)
    
    db.commit()
    db.refresh(db_spec)
    return db_spec

@app.post("/prices/", response_model=PriceResponse)
async def create_price(price: PriceCreate, db: Session = Depends(get_db)):
    db_price = Price(**price.dict())
    db.add(db_price)
    db.commit()
    db.refresh(db_price)
    return db_price

@app.put("/prices/{price_id}", response_model=PriceResponse)
async def update_price(price_id: int, price: PriceCreate, db: Session = Depends(get_db)):
    db_price = db.query(Price).filter(Price.id == price_id).first()
    if not db_price:
        raise HTTPException(status_code=404, detail="Price not found")
    
    for key, value in price.dict().items():
        if value is not None:
            setattr(db_price, key, value)
    
    db.commit()
    db.refresh(db_price)
    return db_price